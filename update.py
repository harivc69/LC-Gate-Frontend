#!/usr/bin/env python3
from ultralytics import YOLO
import torch
import cv2
import math
import numpy as np
import socket
import threading
import time
import datetime as dt
from collections import deque
from sklearn.cluster import DBSCAN
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent / 'common'))
from common.parseFrame import parseStandardFrame

# ================ CONFIGURATION =================
CAMERA_RTSP = "rtsp://root:iitm%40123@192.168.1.90:554/axis-media/media.amp?streamprofile=IITM"
RADAR_HOST = "192.168.1.3"
RADAR_PORT = 8081
OUTPUT_W = 640
OUTPUT_H = 480

HEIGHT_OF_RADAR_OBJECT = 2.9
BETA = -1.5
BETA_RAD = math.radians(BETA)
LX = 0
LY = 0.81
THETA = 28
THETA_RAD = math.radians(THETA)
CX = 320
CY = 240
F = 2.8
SENSOR_WIDTH_MM = 5.76
SENSOR_HEIGHT_MM = 4.32
H_CAM = 4.81


DRAW_ZONE_POLYS = {
    "CZ1": [(540, 283), (466, 244), (364, 251), (417, 295)],
    "CZ2": [(540, 283), (616, 326), (531, 382), (417, 295)],
    "IZ1": [(417, 295), (364, 251), (315, 242), (229, 224), (179, 262), (315, 293)],
    "IZ2": [(417, 295), (531, 382), (368, 414), (125, 301), (179, 262), (315, 293)],
    "TZ1": [(179, 262), (229, 224), (151, 196), (100, 218)],
    "TZ2": [(179, 262), (125, 301), (46, 243), (100, 218)],
}

# Margin (px) around zones for radar point visibility
RADAR_ZONE_MARGIN = 20

# ================ DATASET SAVE CONFIG =================
SAVE_DATASET = False
SAVE_DIR = "dataset"

if SAVE_DATASET:
    Path(SAVE_DIR).mkdir(exist_ok=True)
    Path(f"{SAVE_DIR}/rgb").mkdir(exist_ok=True)
    Path(f"{SAVE_DIR}/dvi").mkdir(exist_ok=True)
    Path(f"{SAVE_DIR}/dvi_overlay").mkdir(exist_ok=True)
    Path(f"{SAVE_DIR}/fusion").mkdir(exist_ok=True)
    Path(f"{SAVE_DIR}/video").mkdir(exist_ok=True)

# ================ COORDINATE TRANSFORMATION FUNCTIONS =================
def calculate_yr_new(Yr, height_of_radar_object):
    Yr_new = Yr**2 - height_of_radar_object**2
    if Yr_new <= 0:
        return 0
    return math.sqrt(Yr_new)

def calculate_xrw(Xr, Yr_new, BETA):
    Xrw = Xr * np.cos(BETA) + Yr_new * math.sin(BETA)
    Yrw = -Xr * np.sin(BETA) + Yr_new * math.cos(BETA)
    return Xrw, Yrw

def camera_world_to_camera(xcw, ycw, zcw, H, theta):
    R_pitch = np.array([
        [1, 0, 0],
        [0, -np.sin(theta), -np.cos(theta)],
        [0,  np.cos(theta),  np.sin(theta)]
    ])
    T = np.array([
        0,
        H * np.cos(theta),
        H * np.sin(theta)
    ])
    Pw = np.array([xcw, ycw, zcw])
    Pc = R_pitch @ Pw + T
    xc, yc, zc = Pc
    return xc, yc, zc

def apply_camera_yaw_eq5(xc, yc, zc, THETA):
    cosb = np.cos(THETA)
    sinb = np.sin(THETA)
    xc_new = xc * cosb + zc * sinb
    yc_new = yc
    zc_new = -xc * sinb + zc * cosb
    return xc_new, yc_new, zc_new

def focal_length_in_pixels(F, sensor_width_mm, image_width_px, sensor_height_mm, image_height_px):
    fx = (F / sensor_width_mm) * image_width_px
    fy = (F / sensor_height_mm) * image_height_px
    return fx, fy

def camera_pixels(xc_new, yc_new, zc_new, fx, fy, Cx, Cy):
    if zc_new <= 0:
        return None, None
    Xp = xc_new/zc_new * fx + Cx
    Yp = yc_new/zc_new * fy + Cy
    return Xp, Yp

def radar_to_pixel(Xr, Yr):
    try:
        Yr_new = calculate_yr_new(Yr, HEIGHT_OF_RADAR_OBJECT)
        Xrw, Yrw = calculate_xrw(Xr, Yr_new, BETA_RAD)
        xc, yc, zc = camera_world_to_camera(Xrw - LX, Yrw - LY, 0, H=H_CAM, theta=THETA_RAD)
        xc_new, yc_new, zc_new = apply_camera_yaw_eq5(xc, yc, zc, BETA_RAD)
        fx, fy = focal_length_in_pixels(F, SENSOR_WIDTH_MM, OUTPUT_W, SENSOR_HEIGHT_MM, OUTPUT_H)
        Xp, Yp = camera_pixels(xc_new, yc_new, zc_new, fx, fy, CX, CY)
        return Xp, Yp
    except:
        return None, None


def get_zone(px, py, zone_polys):
    """Return zone name if point (px, py) is inside any zone, else None."""
    for zn, zpts in zone_polys.items():
        contour = np.array(zpts, dtype=np.int32)
        if cv2.pointPolygonTest(contour, (float(px), float(py)), False) >= 0:
            return zn
    return None


def build_expanded_zone_mask(w, h, zone_polys, margin):
    """Create a binary mask covering all zones expanded by 'margin' pixels."""
    mask = np.zeros((h, w), dtype=np.uint8)
    for zpts in zone_polys.values():
        pts = np.array(zpts, dtype=np.int32)
        cv2.fillPoly(mask, [pts], 255)
    if margin > 0:
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (margin*2+1, margin*2+1))
        mask = cv2.dilate(mask, kernel)
    return mask


def is_in_expanded_zone(px, py, mask):
    """Check if point is inside the expanded zone mask."""
    h, w = mask.shape
    if 0 <= px < w and 0 <= py < h:
        return mask[py, px] > 0
    return False


# ================ THREADED CAMERA READER (SMOOTH RTSP) =================
class CameraReader:
    """Continuously grabs RTSP frames in a background thread.
    The main loop always gets the latest frame without blocking."""
    def __init__(self, src, api=cv2.CAP_FFMPEG):
        self.cap = cv2.VideoCapture(src, api)
        self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        self.lock = threading.Lock()
        self.frame = None
        self.running = False

    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self._grab_loop, daemon=True)
        self.thread.start()
        return self

    def _grab_loop(self):
        while self.running:
            ok, frame = self.cap.read()
            if not ok:
                continue
            with self.lock:
                self.frame = frame

    def read(self):
        with self.lock:
            return self.frame.copy() if self.frame is not None else None

    def stop(self):
        self.running = False
        self.cap.release()


# ================ RADAR TCP READER (REAL-TIME) =================
class RadarTCPReader:
    def __init__(self, host, port, ring_size=30):
        self.host = host
        self.port = port
        self.running = False
        self.lock = threading.Lock()
        self.ring = deque(maxlen=ring_size)

    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self._read_loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False

    def _read_loop(self):
        MAGIC_WORD = bytearray(b'\x02\x01\x04\x03\x06\x05\x08\x07')

        while self.running:
            try:
                with socket.create_connection((self.host, self.port), timeout=5.0) as sock:
                    sock.settimeout(1.0)
                    print(f"[RADAR] Connected to {self.host}:{self.port}")
                    buffer = b""

                    while self.running:
                        try:
                            chunk = sock.recv(4096)
                            if not chunk:
                                break
                            buffer += chunk

                            while True:
                                magic_idx = buffer.find(MAGIC_WORD)
                                if magic_idx == -1:
                                    break

                                next_magic = buffer.find(MAGIC_WORD, magic_idx + 1)
                                if next_magic == -1:
                                    break

                                frame_data = buffer[magic_idx:next_magic]
                                buffer = buffer[next_magic:]

                                if len(frame_data) > 8:
                                    self._process_frame(frame_data)
                        except socket.timeout:
                            continue
            except:
                time.sleep(2)

    def _process_frame(self, frame_data):
        try:
            parsed = parseStandardFrame(frame_data)
            if "pointCloud" not in parsed:
                return

            objects = []
            for point in parsed["pointCloud"]:
                objects.append({
                    "x": float(point[0]),
                    "y": float(point[1]),
                    "vx": float(point[3]) if len(point) > 3 else 0,
                    "snr": float(point[4]) if len(point) > 4 else 0,
                    "noise": float(point[5]) if len(point) > 5 else 1,
                })

            with self.lock:
                timestamp = time.monotonic()
                self.ring.append({
                    "timestamp": timestamp,
                    "objects": objects
                })

        except:
            pass

    def get_closest(self, camera_time):
        """Return the radar frame closest in time to camera_time."""
        with self.lock:
            if len(self.ring) == 0:
                return None
            best = None
            best_dt = float('inf')
            for frame in self.ring:
                dt = abs(camera_time - frame["timestamp"])
                if dt < best_dt:
                    best_dt = dt
                    best = frame
            return best

    def get_objects(self):
        """Legacy: return latest radar frame."""
        with self.lock:
            if len(self.ring) > 0:
                return self.ring[-1]
            return None


# ================ MAIN =================
def main():
    # Real-time RTSP camera (threaded for smooth video)
    cam = CameraReader(CAMERA_RTSP)
    cam.start()
    print("[CAMERA] Waiting for RTSP stream...")
    while cam.read() is None:
        time.sleep(0.1)
    print("[CAMERA] Stream connected.")

    # Real-time TCP radar
    radar = RadarTCPReader(RADAR_HOST, RADAR_PORT)
    radar.start()

    model = YOLO("20_03_2026_best.pt")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print("Using device:", device)
    model.to(device)

    # Build expanded zone mask for radar filtering (zones + margin)
    radar_zone_mask = build_expanded_zone_mask(OUTPUT_W, OUTPUT_H, DRAW_ZONE_POLYS, RADAR_ZONE_MARGIN)

    cv2.namedWindow("Camera")
    cv2.namedWindow("Radar")
    cv2.namedWindow("Fusion")

    # ---- Shared display state (processing thread -> main thread) ----
    display_lock = threading.Lock()
    black = np.zeros((OUTPUT_H, OUTPUT_W, 3), dtype=np.uint8)
    display = {
        "camera": black.copy(),
        "radar": black.copy(),
        "fusion": black.copy(),
        "dvi": black.copy(),
    }
    running = [True]   # mutable flag for threads
    frame_count = [0]

    # ================ PROCESSING THREAD ================
    def processing_loop():
        zones_order = ["CZ1", "CZ2", "IZ1", "IZ2", "TZ1", "TZ2"]

        while running[0]:
            frame = cam.read()
            if frame is None:
                time.sleep(0.01)
                continue

            camera_time = time.monotonic()
            frame = cv2.resize(frame, (OUTPUT_W, OUTPUT_H))
            camera_view = frame.copy()
            radar_view = np.zeros_like(frame)
            fusion_view = frame.copy()
            dvi_base = frame.copy()

            # Run YOLO on CLEAN frame (before drawing zones)
            results = model(frame, imgsz=640, device=device,
                            half=True if device == "cuda" else False,
                            iou=0.4, verbose=False)[0]

            # Draw zones AFTER YOLO detection
            for zone_name, pts in DRAW_ZONE_POLYS.items():
                pts_np = np.array(pts, dtype=np.int32)
                cv2.polylines(camera_view, [pts_np], isClosed=True, color=(255, 255, 0), thickness=2)
                cv2.polylines(fusion_view, [pts_np], isClosed=True, color=(255, 255, 0), thickness=2)
                cv2.polylines(radar_view, [pts_np], isClosed=True, color=(255, 255, 0), thickness=2)

            # ================ CAMERA ZONE COUNTING ================
            camera_zone_counts = {z: 0 for z in zones_order}

            raw_boxes = []
            raw_confs = []
            for box in results.boxes:
                conf = float(box.conf[0])
                if conf < 0.2:
                    continue
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                raw_boxes.append((x1, y1, x2, y2))
                raw_confs.append(conf)

            # Custom NMS
            keep = []
            for i in range(len(raw_boxes)):
                discard = False
                for j in keep:
                    bx1 = max(raw_boxes[i][0], raw_boxes[j][0])
                    by1 = max(raw_boxes[i][1], raw_boxes[j][1])
                    bx2 = min(raw_boxes[i][2], raw_boxes[j][2])
                    by2 = min(raw_boxes[i][3], raw_boxes[j][3])
                    inter = max(0, bx2 - bx1) * max(0, by2 - by1)
                    area_i = (raw_boxes[i][2] - raw_boxes[i][0]) * (raw_boxes[i][3] - raw_boxes[i][1])
                    area_j = (raw_boxes[j][2] - raw_boxes[j][0]) * (raw_boxes[j][3] - raw_boxes[j][1])
                    union = area_i + area_j - inter
                    iou = inter / union if union > 0 else 0
                    if iou > 0.3:
                        discard = True
                        break
                if not discard:
                    keep.append(i)

            yolo_boxes = []
            yolo_bottom_centers = []

            for i in keep:
                x1, y1, x2, y2 = raw_boxes[i]
                cv2.rectangle(fusion_view, (x1, y1), (x2, y2), (160, 255, 160), 2)
                cv2.rectangle(camera_view, (x1, y1), (x2, y2), (160, 255, 160), 2)
                yolo_boxes.append((x1, y1, x2, y2))

                bcx = (x1 + x2) // 2
                bcy = y2
                yolo_bottom_centers.append((bcx, bcy))
                cv2.circle(fusion_view, (bcx, bcy), 4, (0, 255, 0), -1)

                zone = get_zone(bcx, bcy, DRAW_ZONE_POLYS)
                if zone:
                    camera_zone_counts[zone] += 1

            # === DVI CHANNEL IMAGES ===
            D_img = np.zeros((OUTPUT_H, OUTPUT_W), dtype=np.uint8)
            V_img = np.zeros((OUTPUT_H, OUTPUT_W), dtype=np.uint8)
            I_img = np.zeros((OUTPUT_H, OUTPUT_W), dtype=np.uint8)

            roi_points = []

            # === GET RADAR DATA (real-time sync) ===
            radar_data = radar.get_closest(camera_time)
            objects = []
            sync_dt_ms = 0.0

            if radar_data is not None:
                radar_time = radar_data["timestamp"]
                radar_objects = radar_data["objects"]
                dt_seconds = camera_time - radar_time
                sync_dt_ms = dt_seconds * 1000.0

                for obj in radar_objects:
                    objects.append({
                        "x": obj["x"], "y": obj["y"],
                        "vx": obj["vx"], "snr": obj["snr"], "noise": obj["noise"]
                    })

            # Display timestamp
            now_str = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
            cv2.putText(camera_view, f"Camera: {now_str}", (10, 25),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
            cv2.putText(radar_view, f"Radar:  {now_str}", (10, 25),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
            cv2.putText(fusion_view, f"Fusion: {now_str}", (10, 25),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)

            # === DBSCAN CLUSTERING (radar world coords) ===
            clustered_objects = []
            db_labels = np.array([])
            if len(objects) > 0:
                coords = np.array([[o["x"], o["y"]] for o in objects])
                db = DBSCAN(eps=0.5, min_samples=5).fit(coords)
                db_labels = db.labels_
                for label in set(db_labels):
                    if label == -1:
                        continue
                    pts = coords[db_labels == label]
                    centroid = pts.mean(axis=0)
                    clustered_objects.append({"x": centroid[0], "y": centroid[1]})

            # ================ RADAR CLUSTER PROJECTION ================
            radar_pixel_positions = []
            for obj in clustered_objects:
                Xr = obj["x"]
                Yr = obj["y"]
                Xp, Yp = radar_to_pixel(Xr, Yr)
                if Xp is not None and Yp is not None:
                    Xp_int = int(round(Xp))
                    Yp_int = int(round(Yp))
                    if 0 <= Xp_int < OUTPUT_W and 0 <= Yp_int < OUTPUT_H:
                        if is_in_expanded_zone(Xp_int, Yp_int, radar_zone_mask):
                            radar_pixel_positions.append((Xp_int, Yp_int))
                            cv2.circle(fusion_view, (Xp_int, Yp_int), 6, (0, 0, 255), -1)
                            cv2.putText(fusion_view, f"({Xp:.1f},{Yp:.1f})",
                                (Xp_int + 10, Yp_int - 5),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 0), 1)
                            cv2.circle(radar_view, (Xp_int, Yp_int), 6, (0, 255, 0), -1)
                            cv2.putText(radar_view, f"X:{Xr:.2f}m Y:{Yr:.2f}m",
                                (Xp_int + 10, Yp_int - 5),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 0), 1)
                        else:
                            radar_pixel_positions.append(None)
                    else:
                        radar_pixel_positions.append(None)
                else:
                    radar_pixel_positions.append(None)

            # === SECOND DBSCAN IN PIXEL SPACE FOR ROI ===
            pixel_points = []
            for rpos in radar_pixel_positions:
                if rpos is not None:
                    pixel_points.append([rpos[0], rpos[1]])

            radar_zone_counts = {z: 0 for z in zones_order}
            roi_boxes = []
            roi_bottom_centers = []

            if len(pixel_points) > 0:
                pixel_points = np.array(pixel_points)
                db2 = DBSCAN(eps=60, min_samples=1).fit(pixel_points)
                labels = db2.labels_

                for lbl in set(labels):
                    if lbl == -1:
                        continue
                    cluster_pts = pixel_points[labels == lbl]
                    if len(cluster_pts) == 0:
                        continue
                    x1, y1 = cluster_pts.min(axis=0)
                    x2, y2 = cluster_pts.max(axis=0)
                    pad = 30
                    x1 = int(max(0, x1 - pad))
                    y1 = int(max(0, y1 - pad))
                    x2 = int(min(OUTPUT_W, x2 + pad))
                    y2 = int(min(OUTPUT_H, y2 + pad))
                    cv2.rectangle(fusion_view, (x1, y1), (x2, y2), (0, 255, 255), 2)

                    roi_boxes.append((x1, y1, x2, y2))
                    roi_bcx = (x1 + x2) // 2
                    roi_bcy = y2
                    cv2.circle(fusion_view, (roi_bcx, roi_bcy), 4, (0, 0, 255), -1)
                    roi_bottom_centers.append((roi_bcx, roi_bcy))

                    zone = get_zone(roi_bcx, roi_bcy, DRAW_ZONE_POLYS)
                    if zone:
                        radar_zone_counts[zone] += 1

            # ================ FUSION ZONE COUNTING ================
            matched_roi_indices = set()
            for ri, (rx1, ry1, rx2, ry2) in enumerate(roi_boxes):
                for ci, (cx1, cy1, cx2, cy2) in enumerate(yolo_boxes):
                    ix1 = max(rx1, cx1)
                    iy1 = max(ry1, cy1)
                    ix2 = min(rx2, cx2)
                    iy2 = min(ry2, cy2)
                    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
                    if inter > 0:
                        matched_roi_indices.add(ri)
                        break

            fusion_zone_counts = {z: 0 for z in zones_order}
            for ci, (bcx, bcy) in enumerate(yolo_bottom_centers):
                zone = get_zone(bcx, bcy, DRAW_ZONE_POLYS)
                if zone:
                    fusion_zone_counts[zone] += 1
            for ri, (rpx, rpy) in enumerate(roi_bottom_centers):
                if ri in matched_roi_indices:
                    continue
                zone = get_zone(rpx, rpy, DRAW_ZONE_POLYS)
                if zone:
                    fusion_zone_counts[zone] += 1

            # ================ DISPLAY ZONE COUNTS ================
            cam_parts = []
            for z in zones_order:
                c = camera_zone_counts[z]
                cam_parts.append(f"{z}-{c}C" if c > 0 else f"{z}-0")
            cam_text = " ".join(cam_parts)

            rad_parts = []
            for z in zones_order:
                r = radar_zone_counts[z]
                rad_parts.append(f"{z}-{r}R" if r > 0 else f"{z}-0")
            rad_text = " ".join(rad_parts)

            fus_parts = []
            for z in zones_order:
                fus_parts.append(f"{z}-{fusion_zone_counts[z]}")
            fus_text = " ".join(fus_parts)

            cv2.putText(fusion_view, cam_text, (10, 50),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
            cv2.putText(fusion_view, rad_text, (10, 75),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
            cv2.putText(fusion_view, fus_text, (10, 100),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

            # === DVI CHANNELS — ONLY clustered points ===
            for i, raw in enumerate(objects):
                if len(db_labels) > 0 and db_labels[i] == -1:
                    continue
                Xr = raw["x"]
                Yr = raw["y"]
                vx = raw["vx"]
                snr = raw["snr"]
                noise = raw["noise"]
                d = math.sqrt(Xr**2 + Yr**2)
                Xp, Yp = radar_to_pixel(Xr, Yr)
                if Xp is None:
                    continue
                Xp = int(Xp)
                Yp = int(Yp)
                if 0 <= Xp < OUTPUT_W and 0 <= Yp < OUTPUT_H:
                    D = np.clip((d * 5.1), 0, 255)
                    V = np.clip((abs(vx) * 7.65), 0, 255)
                    snr_linear = 10 ** (snr * 0.01)
                    I_val = 10 * np.log10(snr_linear * (noise * 0.1) + 1e-6)
                    I = np.clip((I_val / 100.0) * 255.0, 0, 255)
                    cv2.circle(D_img, (Xp, Yp), 3, int(D), -1)
                    cv2.circle(V_img, (Xp, Yp), 3, int(V), -1)
                    cv2.circle(I_img, (Xp, Yp), 3, int(I), -1)
                    roi_points.append((Xp, Yp))

            if np.max(D_img) > 0:
                D_img = cv2.normalize(D_img, None, 0, 255, cv2.NORM_MINMAX)
            if np.max(V_img) > 0:
                V_img = cv2.normalize(V_img, None, 0, 255, cv2.NORM_MINMAX)
            if np.max(I_img) > 0:
                I_img = cv2.normalize(I_img, None, 0, 255, cv2.NORM_MINMAX)

            DVI_image = cv2.merge((D_img, V_img, I_img))

            # Superimpose DVI on camera image
            dvi_mask = cv2.cvtColor(DVI_image, cv2.COLOR_BGR2GRAY) > 0
            dvi_overlay = dvi_base.copy()
            dvi_overlay[dvi_mask] = DVI_image[dvi_mask]

            # === DRAW 2nd DBSCAN ROI BOXES ON DVI OVERLAY ===
            if len(pixel_points) > 0 and isinstance(pixel_points, np.ndarray):
                for lbl in set(labels):
                    if lbl == -1:
                        continue
                    cluster_pts = pixel_points[labels == lbl]
                    if len(cluster_pts) == 0:
                        continue
                    x1, y1 = cluster_pts.min(axis=0)
                    x2, y2 = cluster_pts.max(axis=0)
                    pad = 20
                    x1 = int(max(0, x1 - pad))
                    y1 = int(max(0, y1 - pad))
                    x2 = int(min(OUTPUT_W, x2 + pad))
                    y2 = int(min(OUTPUT_H, y2 + pad))

            # ================= SAVE DATASET =================
            if SAVE_DATASET:
                fusion_6ch = np.dstack((frame, D_img, V_img, I_img))
                cv2.imwrite(f"{SAVE_DIR}/rgb/rgb_{frame_count[0]:06d}.png", frame)
                cv2.imwrite(f"{SAVE_DIR}/dvi/dvi_{frame_count[0]:06d}.png", DVI_image)
                cv2.imwrite(f"{SAVE_DIR}/dvi_overlay/dvi_overlay_{frame_count[0]:06d}.png", dvi_overlay)
                np.save(f"{SAVE_DIR}/fusion/fusion_{frame_count[0]:06d}.npy", fusion_6ch)

            # === Push finished views to shared display ===
            with display_lock:
                display["camera"] = camera_view
                display["radar"] = radar_view
                display["fusion"] = fusion_view
                display["dvi"] = dvi_overlay

            frame_count[0] += 1

    # Start processing in background thread
    proc_thread = threading.Thread(target=processing_loop, daemon=True)
    proc_thread.start()

    # ================ MAIN DISPLAY LOOP (smooth ~33fps) ================
    while running[0]:
        with display_lock:
            cv2.imshow("Camera", display["camera"])
            cv2.imshow("Radar", display["radar"])
            cv2.imshow("Fusion", display["fusion"])
            cv2.imshow("DVI Output", display["dvi"])

        key = cv2.waitKey(30) & 0xFF
        if key == 27:
            running[0] = False

    cam.stop()
    radar.stop()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
