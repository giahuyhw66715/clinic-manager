# ClinicManager - Tổng hợp Chức năng & Luồng Hoạt động

> Tài liệu mô tả toàn bộ chức năng, luồng hoạt động, mô hình dữ liệu và quy tắc nghiệp vụ của hệ thống quản lý phòng khám.

## 1. Tổng quan

### 1.1. Công nghệ

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Form & Validation**: React Hook Form + Zod (`zodResolver`)
- **Data fetching**: TanStack Query (React Query)
- **Routing**: React Router v6
- **Backend**: Supabase (Auth, PostgreSQL, Realtime, RLS, pg_cron)
- **PDF**: `@react-pdf/renderer` (xuất hóa đơn)
- **Múi giờ**: toàn hệ thống hiển thị theo `Asia/Ho_Chi_Minh`

### 1.2. Các vai trò (Roles)

| Vai trò | Mô tả |
|---------|-------|
| `patient` | Bệnh nhân - đặt/đổi/hủy lịch, xem hồ sơ, đơn thuốc, hóa đơn |
| `doctor` | Bác sĩ - quản lý lịch hẹn, khám, ghi SOAP, kê đơn, hoàn tất khám |
| `pharmacist` | Dược sĩ - check-in bệnh nhân, xử lý đơn thuốc, quản lý kho |
| `admin` | Quản trị - dashboard, người dùng, bác sĩ, lịch làm việc, chuyên khoa, thuốc |

### 1.3. Phân luồng điều hướng chính

```
"/"            -> LandingPage (nếu chưa đăng nhập) / RoleHome (nếu đã đăng nhập)
"/login"       -> Đăng nhập
"/register"    -> Đăng ký tài khoản bệnh nhân
"/app/*"       -> Khu vực đã đăng nhập (có sidebar theo vai trò)
   patient:    /app/appointments | /app/history | /app/prescriptions | /app/invoices | /app/book
   doctor:     /app/doctor/queue | /app/doctor/patients | /app/doctor/schedule |
               /app/doctor/patients/:patientId | /app/doctor/appointments/:appointmentId
   pharmacist: /app/pharmacy/queue | /app/pharmacy/checkin | /app/pharmacy/inventory |
               /app/pharmacy/prescriptions/:id
   admin:      /app/admin | /app/admin/users | /app/admin/doctors |
               /app/admin/departments | /app/admin/medications
```

- `RoleRoute` (dùng `<Outlet/>`) chặn truy cập: người dùng không thuộc vai trò được phép sẽ bị chuyển về `/app`.
- `RoleHome` tự chuyển hướng theo vai trò: patient → My Appointments, doctor → Appointments queue, pharmacist → Prescription Queue, admin → Dashboard.
- Người dùng chưa đăng nhập truy cập `/app/*` bị chuyển về `/login`.

---

## 2. Mô hình dữ liệu

| Bảng | Vai trò |
|------|---------|
| `profiles` | Hồ sơ người dùng (id, email, full_name, phone, role, allergies) |
| `departments` | Chuyên khoa (id, name, description) |
| `doctors` | Bác sĩ (user_id, department_id, specialty, bio, consultation_fee) |
| `doctor_schedules` | Lịch làm việc tuần (doctor_id, day_of_week, start_time, end_time, slot_minutes) |
| `doctor_off_days` | Ngày nghỉ của bác sĩ (doctor_id, off_date, reason) |
| `medications` | Danh mục thuốc (name, dosage_unit, price, stock_qty, reorder_level) |
| `drug_interactions` | Cặp thuốc tương tác (severity, description) |
| `patient_allergies` | Dị ứng bệnh nhân (medication_id hoặc allergen, severity) |
| `appointments` | Lịch hẹn (patient_id, doctor_id, date, time_slot, status, reason, cancel_reason, paid) |
| `medical_records` | Hồ sơ khám bệnh SOAP (symptoms, diagnosis, treatment_plan, notes) |
| `prescriptions` | Đơn thuốc (status: sent/preparing/ready/delivered, notes) |
| `prescription_items` | Chi tiết đơn (medication_id, dosage, quantity, instructions) |
| `invoices` | Hóa đơn (total_amount, paid, paid_at) |
| `notifications` | Thông báo (user_id, type, title, body, read_at) |

**Enums**:

- `appointment_status`: `pending`, `confirmed`, `checked-in`, `in-progress`, `completed`, `cancelled`, `no-show`
- `prescription_status`: `sent`, `preparing`, `ready`, `delivered`
- `severity`: `mild`, `moderate`, `severe`
- `user_role`: `patient`, `doctor`, `pharmacist`, `admin`

### 2.1. Bảo mật (RLS)

- Mọi bảng đều bật RLS; chính sách dựa trên `auth.uid()`, `current_role()`, `current_doctor_id()`.
- Bệnh nhân chỉ xem được dữ liệu của mình; bác sĩ xem được lịch hẹn/hồ sơ của chính mình; dược sĩ và admin có quyền rộng hơn theo từng bảng.
- Quyền ghi (insert/update/delete) được giới hạn theo vai trò ở từng policy.

### 2.2. Trigger & Cron

- **handle_new_user**: tự tạo bản ghi `profiles` khi đăng ký user mới.
- **decrement_stock_on_prescription**: tự giảm `stock_qty` (không dưới 0) khi thêm item vào `prescription_items`.
- **Cron `mark-no-show-stale-appointments`** (pg_cron, chạy 00:00 giờ Việt Nam = 17:00 UTC): đánh dấu `no-show` các lịch hẹn ngày trước còn `pending`/`confirmed`.

---

## 3. Chức năng chung (dùng chung toàn hệ thống)

- **AppLayout**: sidebar cố định theo vai trò (desktop) + drawer (mobile), header dính kèm notification bell và menu tài khoản (đăng xuất). Nav được tô sáng bằng khớp tiền tố dài nhất.
- **NotificationBell** (`useNotifications`): tải 20 thông báo gần nhất, cập nhật realtime qua Supabase channel, đếm chưa đọc, đánh dấu đã đọc (một/một vài, hoặc tất cả).
- **Pagination**: component dùng chung `Pagination` + hook `usePagination`, `PAGE_SIZE = 12`; hiển thị "Showing x–y of z".
- **StatusBadge**: `AppointmentStatusBadge` và `PrescriptionStatusBadge` với màu chuẩn hóa; dùng `shrink-0 whitespace-nowrap` để không tràn layout.
- **Múi giờ**: `formatDateTime` dùng `timeZone: "Asia/Ho_Chi_Minh"`; ngày tháng trong booking/reschedule dùng hàm `toDateKey`/`todayDateKey` (local), tránh lệch 1 ngày khi dùng `toISOString()`.
- **Thông báo (notifications)**: tạo qua `createNotification` khi: đặt lịch thành công, kê đơn, hoàn tất khám, bác sĩ hủy khám.

---

## 4. Module Auth & Trang chủ

### 4.1. LandingPage (`/`)

Hero + thống kê nổi bật + 6 tính năng chính + 3 vai trò + "Cách hoạt động" (3 bước) + CTA + footer. Nút dẫn tới đăng nhập/đăng ký.

### 4.2. Đăng nhập (`/login`)

- Email + mật khẩu, gọi `signInWithPassword` qua `AuthContext`.
- Zod `loginSchema`: `email` bắt buộc đúng định dạng (max 100), `password` từ 6 đến 100 ký tự.
- Sai thông tin → toast lỗi.

### 4.3. Đăng ký (`/register`)

- `registerSchema`: `fullName` 2–100 ký tự, `email` hợp lệ (max 100), `phone` tùy chọn khớp regex `/^[\d+\-\s\(\)]+$/`, `password` 6–100, `confirmPassword` khớp mật khẩu (báo lỗi ở trường confirm).
- Đăng ký thành công → toast → chuyển về `/login`. Tài khoản mới mặc định vai trò `patient`.

---

## 5. Module Bệnh nhân (Patient)

### 5.1. Đặt lịch hẹn (`/app/book`) - Wizard 3 bước

1. **Chọn chuyên khoa**: chọn 1 `department` (danh sách sắp theo tên).
2. **Chọn bác sĩ**: liệt kê bác sĩ thuộc khoa (tên, chuyên khoa, phí khám) **hoặc** bật **"Auto-assign a doctor"** (mặc định). Chế độ auto: hệ thống sẽ chọn bác sĩ ít lịch nhất còn trống cho slot đã chọn.
3. **Chọn ngày + giờ**:
   - Ngày: từ hôm nay đến **+45 ngày**; ngày không có slot bị disable.
   - Giờ: liệt kê các slot khả dụng (trừ lịch nghỉ, ngày nghỉ, slot đã đặt). Slot quá khứ (nếu hôm nay) bị disable.
   - Ở chế độ auto-assign, tập slot = hợp của slot khả dụng của tất cả bác sĩ trong khoa.

**Luồng đặt lịch**:

```
Chọn department -> Chọn doctor (hoặc auto) -> Chọn ngày/giờ -> Nhập lý do (tùy chọn)
  -> createAppointment(status = pending)
  -> createNotification("Appointment booked")
  -> toast success -> invalidate my-appointments -> điều hướng về /app/appointments
```

- `createAppointment` chèn `appointments` với `status = 'pending'`.
- Nếu auto-assign: `pickDoctor(slot)` chọn bác sĩ có ít `bookedSlots` nhất trong số bác sĩ rảnh slot đó; nếu không ai rảnh → báo lỗi.

### 5.2. Lịch hẹn của tôi (`/app/appointments`)

- Danh sách lịch hẹn (sắp theo ngày giảm dần, `created_at` giảm dần), phân trang 12/trang.
- Thẻ lịch hiển thị: bác sĩ, chuyên khoa, ngày/giờ, lý do, trạng thái.
- Hành động cho trạng thái `pending`/`confirmed`:
  - **Reschedule**: mở dialog chọn ngày/giờ mới (chỉ hiển thị slot khả dụng của đúng bác sĩ đó, slot quá khứ bị disable). Khi lưu: cập nhật `appointment_date`, `time_slot`, `status` về `pending`.
  - **Cancel**: xác nhận qua `ConfirmDialog`, cập nhật `status = 'cancelled'`.
- **Cửa sổ hủy/đổi 6 giờ** (`CANCEL_WINDOW_HOURS = 6`): chỉ cho phép khi còn ≥ 6 giờ trước thời điểm lịch thực tế (`appointment_date` + `time_slot`).
- Nút "New appointment" dẫn tới `/app/book`.

### 5.3. Lịch sử khám (`/app/history`)

- Timeline các `medical_records` của bệnh nhân (mới nhất trước), hiển thị chẩn đoán, bác sĩ, thời gian và các mục SOAP có nội dung.

### 5.4. Đơn thuốc của tôi (`/app/prescriptions`)

- Danh sách đơn thuốc: tên bác sĩ, trạng thái, thời gian phát hành, từng mục thuốc (liều, số lượng, hướng dẫn), giá từng dòng và tổng tiền.

### 5.5. Hóa đơn (`/app/invoices`)

- Danh sách hóa đơn với trạng thái Paid/Unpaid.
- Nút **Download PDF** dùng `@react-pdf/renderer` xuất hóa đơn A4: số hóa đơn, bệnh nhân, bác sĩ, lịch hẹn, chi tiết phí khám + tiền thuốc, tổng cộng, trạng thái thanh toán.

---

## 6. Module Bác sĩ (Doctor)

### 6.1. Lịch hẹn (`/app/doctor/queue`) - 3 tab

- **Today's Queue**: lịch hẹn hôm nay với trạng thái `pending/confirmed/checked-in/in-progress/no-show`, sắp theo giờ. Cập nhật realtime.
  - Thẻ hiển thị: giờ khám, tên/số điện thoại bệnh nhân, dị ứng (nếu có), lý do khám.
  - Nút **Start visit** (cho `confirmed`/`checked-in`): đổi `in-progress`.
  - Nút **No-show** (cho `pending`/`confirmed`/`checked-in`): đổi `no-show`.
  - Nút **Open** → mở trang hồ sơ lịch hẹn (`/app/doctor/appointments/:id`).
- **Completed**: lịch hẹn `completed` (sắp theo ngày + giờ), chỉ xem, nút "View record".
- **No-show & Cancelled**: lịch `no-show`/`cancelled` trong **30 ngày** qua, hiển thị lý do hủy nếu có.

Cập nhật bằng mutation + invalidate 3 query keys; realtime qua channel `doctor-queue-<doctorId>`.

### 6.2. Hồ sơ lịch hẹn (`/app/doctor/appointments/:appointmentId`) - Wizard 2 bước

Thông tin bệnh nhân (tên, phone, email, lý do), cảnh báo dị ứng (từ profile + `patient_allergies`), danh sách đơn thuốc của lần khám này, lịch sử các lần khám trước.

**Bước 1 - SOAP note**:

- Form `soapSchema`: `symptoms`, `diagnosis`, `treatment_plan`, `notes` (đều tùy chọn trong form này).
- Nút **Continue to prescription** chỉ bật khi `diagnosis` có nội dung.
- Nút **Cancel visit**: mở AlertDialog yêu cầu nhập lý do (bắt buộc) → cập nhật `status = 'cancelled'` + `cancel_reason` + thông báo cho bệnh nhân.
- Form SOAP giữ nguyên khi chuyển bước (ẩn bằng `hidden`, không unmount) để không mất dữ liệu.

**Bước 2 - Prescription & complete**:

- Nút "Back to record" quay lại SOAP.
- `PrescriptionForm`: chọn thuốc (search + badge hết/thiếu hàng), liều, số lượng (≥ 1), hướng dẫn, nhiều dòng thuốc, ghi chú. **Cảnh báo tự động**:
  - **Allergy warnings**: thuốc trùng dị ứng trong `patient_allergies` hoặc chuỗi `allergies` của profile.
  - **Drug interaction warnings**: cặp thuốc có trong `drug_interactions`.
  - **Stock warnings**: hết hàng hoặc số lượng vượt tồn kho.
- Gửi đơn: `createPrescription` (status `sent`) + thông báo "New prescription issued" cho bệnh nhân.
- Sau khi gửi đơn → **finalize** (chuỗi bước):
  1. Tự lưu SOAP (`saveSoapMutation`) nếu chưa có medical record cho lịch hẹn này (idempotent).
  2. Kiểm tra đã có prescription; **chưa có thì báo lỗi** ("Send a prescription... before completing").
  3. Tính tổng = phí khám bác sĩ + Σ(giá thuốc × số lượng).
  4. Tạo invoice (`paid = false`).
  5. Cập nhật lịch hẹn `status = 'completed'`.
  6. Thông báo cho bệnh nhân (tổng hóa đơn).
  7. Toast + invalidate các query + điều hướng về `/app/doctor/queue`.
- Lịch hẹn đã `completed`: hiển thị thẻ "Visit completed" chỉ đọc (SOAP + đơn thuốc).

### 6.3. Bệnh nhân của tôi (`/app/doctor/patients`)

- Gom các bệnh nhân từ lịch sử lịch hẹn của bác sĩ (bệnh nhân duy nhất, giữ lần khám mới nhất), tìm kiếm theo tên/phone.
- Nút "View records" → `/app/doctor/patients/:patientId`.

### 6.4. Hồ sơ bệnh nhân (`/app/doctor/patients/:patientId`) - 3 tab

- **Medical records**: danh sách hồ sơ khám của bệnh nhân.
- **Prescriptions**: đơn thuốc đã kê cho bệnh nhân.
- **New consultation**: 
  - Form `recordSchema`: `diagnosis` bắt buộc (min 1, max 500), `symptoms`/`treatment_plan`/`notes` tùy chọn max 500. Lưu `medical_records` với `appointment_id = null`.
  - Kê đơn qua `PrescriptionForm` (không gắn lịch hẹn).

### 6.5. Lịch làm việc của tôi (`/app/doctor/schedule`)

- Bảng giờ làm việc tuần (ngày, giờ bắt đầu/kết thúc, độ dài slot).
- Quản lý **ngày nghỉ**: chọn ngày (không chọn ngày quá khứ), lý do tùy chọn, thêm/xóa.

---

## 7. Module Dược sĩ (Pharmacist)

### 7.1. Check-in bệnh nhân (`/app/pharmacy/checkin`)

- Danh sách lịch hẹn **hôm nay** (status `pending/confirmed/checked-in/in-progress`).
- Nhóm "Awaiting check-in" (`pending`/`confirmed`): nút **Check in** → `status = 'checked-in'`.
- Nhóm "Checked in": hiển thị trạng thái `checked-in`/`in-progress`.
- Cập nhật realtime.

### 7.2. Hàng đợi đơn thuốc (`/app/pharmacy/queue`)

- Tab lọc theo trạng thái: **All / Sent / Preparing / Ready / Delivered** (mặc định: Sent).
- Thẻ đơn: bệnh nhân, bác sĩ, thời gian, tối đa **4 mục thuốc** (+ "N more items"), ghi chú cắt 2 dòng, badge trạng thái.
- Nút chuyển trạng thái theo thứ tự:
  - `sent` → **Start preparing** (`preparing`)
  - `preparing` → **Mark ready** (`ready`)
  - `ready` → **Mark delivered** (`delivered`)
  - `delivered` → badge "Handed to patient".
- Cập nhật realtime, phân trang 12/trang.

### 7.3. Chi tiết đơn thuốc (`/app/pharmacy/prescriptions/:id`)

- Thông tin bệnh nhân, các dòng thuốc (liều, số lượng, hướng dẫn, giá dòng, tồn kho còn lại), tổng tiền.
- Nút chuyển trạng thái tiếp theo (theo cùng chuỗi `sent → preparing → ready → delivered`); khi đã `delivered` hiển thị "Completed".
- Ghi chú: "Stock is deducted automatically when the prescription was sent."

### 7.4. Kho thuốc (`/app/pharmacy/inventory`)

- Bảng thuốc: tên, mô tả, đơn vị, giá, tồn kho, mức đặt hàng lại.
- **Cảnh báo tồn kho thấp**: banner + badge các thuốc `stock_qty <= reorder_level`; tab **All / Low stock**; tìm kiếm theo tên.
- Thêm/Sửa/Xóa thuốc qua dialog (tên bắt buộc; các trường số `min = 0`).

---

## 8. Module Quản trị (Admin)

### 8.1. Dashboard (`/app/admin`)

Thống kê: lịch hẹn hôm nay (kèm số hoàn thành), số bệnh nhân, đơn thuốc trong hàng đợi (tổng), tổng doanh thu (số đã thu), số bác sĩ, số thuốc (số tồn thấp).

Các thẻ phụ: tóm tắt trạng thái lịch hẹn hôm nay (chờ check-in / đã check-in & đang khám / hoàn thành) và phân bố vai trò người dùng (thanh phần trăm).

### 8.2. Người dùng & Vai trò (`/app/admin/users`)

- Bảng người dùng (avatar, tên, email, phone, vai trò, ngày tham gia), tìm kiếm theo tên/email/phone.
- Đổi vai trò (patient/doctor/pharmacist/admin) qua Select + nút **Save** (chỉ lưu khi có thay đổi).

### 8.3. Bác sĩ & Lịch làm việc (`/app/admin/doctors`)

- Bảng bác sĩ: tên, khoa, chuyên khoa, phí khám.
- **Thêm/Sửa bác sĩ**: chọn tài khoản có vai trò `doctor` chưa gắn (khi tạo), chọn khoa, chuyên khoa, phí khám, bio.
- **Lịch tuần**: dialog thiết lập giờ làm việc 7 ngày (start/end/slot minutes); để trống ngày nào là tắt ngày đó (hoặc xóa lịch cũ nếu có). Lưu bằng upsert theo `(doctor_id, day_of_week)`.
- **Ngày nghỉ**: thêm ngày nghỉ, xóa từng ngày (badge có nút ×).
- Xóa bác sĩ qua `ConfirmDialog`.

### 8.4. Chuyên khoa (`/app/admin/departments`)

- Lưới các khoa (tên, mô tả), thêm/sửa (tên bắt buộc, mô tả tùy chọn), xóa qua `ConfirmDialog`.

### 8.5. Thuốc (`/app/admin/medications`)

- Tái sử dụng `InventoryPage` (xem Mục 7.4).

---

## 9. Máy trạng thái (State Machine)

### 9.1. Lịch hẹn (`appointments.status`)

```
Đặt lịch          -> pending
Bệnh nhân đổi lịch -> pending (đặt lại)
Check-in          -> pending/confirmed -> checked-in
Bác sĩ Start visit -> confirmed/checked-in -> in-progress
Bệnh nhân hủy     -> pending/confirmed -> cancelled (trong vòng 6h)
Bác sĩ hủy        -> pending/confirmed/checked-in/in-progress -> cancelled (kèm lý do)
Bác sĩ No-show    -> pending/confirmed/checked-in -> no-show
Cron 00:00        -> pending/confirmed (ngày trước) -> no-show
Hoàn tất khám     -> in-progress -> completed (tự tạo invoice)
```

Ghi chú: `confirmed` hiện không được đặt bởi bất kỳ luồng nào trong code (chỉ `pending` khi đặt/đổi lịch); các thao tác vẫn hỗ trợ trạng thái này cho khả năng mở rộng.

### 9.2. Đơn thuốc (`prescriptions.status`)

```
sent -> preparing -> ready -> delivered
```

- `sent` được tạo bởi bác sĩ; chuỗi còn lại do dược sĩ thực hiện. Mỗi bước đều invalidate + realtime cập nhật.

---

## 10. Quy tắc Validation (Tổng hợp)

**Quy tắc chung (áp dụng cho mọi field):**

| Loại field | Max length | Bắt buộc | Yêu cầu thêm |
|------------|-----------|----------|--------------|
| `input` | 100 ký tự | ≥ 1 ký tự | - |
| `textarea` | 300 ký tự | ≥ 1 ký tự | - |
| Số bắt buộc (`type="number"`) | - | ≥ giá trị tối thiểu (`min`) | chỉ nhập số |
| Số tùy chọn | - | - | nhập tự do |
| `select` bắt buộc | - | đã chọn ≥ 1 option | nút lưu bị disable khi chưa chọn |

**Tổng hợp theo form:**

| Khu vực | Quy tắc |
|---------|---------|
| Đăng nhập | email hợp lệ (≤100), password 6–100 |
| Đăng ký | fullName 2–100; email hợp lệ (≤100); phone tùy chọn ≤100, chỉ gồm `0-9 + - space ( )`; password 6–100; confirmPassword khớp |
| Đặt lịch | phải chọn khoa; bác sĩ hoặc auto-assign; ngày trong [hôm nay, +45 ngày]; giờ trong slot khả dụng; không chọn slot quá khứ; reason textarea ≤300 |
| SOAP (PatientRecordPage) | diagnosis bắt buộc (≤100) để qua bước 2; symptoms/treatment_plan/notes textarea ≤300; lý do hủy textarea ≤300 (bắt buộc) |
| SOAP (PatientHistoryPage) | diagnosis bắt buộc (≤100); symptoms/treatment_plan/notes ≤300 |
| Kê đơn | ≥ 1 dòng có thuốc; mọi dòng có thuốc phải có quantity > 0; dosage/instructions input ≤100; notes textarea ≤300 |
| Hủy/đổi lịch (bệnh nhân) | chỉ khi còn ≥ 6h trước giờ khám và trạng thái `pending`/`confirmed` |
| Hoàn tất khám | bắt buộc có prescription trước khi tạo invoice/hoàn tất |
| Departments | name bắt buộc (≤100); description textarea ≤300 |
| Doctors | user bắt buộc khi tạo; department bắt buộc; specialty bắt buộc (≤100); bio input ≤100; fee số ≥0; slot số ≥10 phút |
| Inventory | name bắt buộc (≤100); dosage_unit/description ≤100; price/stock/reorder số ≥0 |
| My Schedule | reason input ≤100 |

---

## 11. Thư mục mã nguồn

```
src/
├── components/
│   ├── layout/            # AppLayout, NotificationBell
│   ├── shared/            # Pagination, StatusBadge, EmptyState, PageHeader, ConfirmDialog,
│   │                      # SearchInput, Skeletons, StatCard
│   └── ui/                # shadcn/ui components
├── contexts/AuthContext.tsx
├── features/
│   ├── auth/              # LoginPage, RegisterPage
│   ├── booking/           # BookAppointmentPage
│   ├── doctor/            # DoctorQueuePage, PatientRecordPage, MyPatientsPage,
│   │                      # MySchedulePage, PatientHistoryPage, components/PrescriptionForm
│   ├── patient/           # MyAppointmentsPage, MedicalHistoryPage, MyPrescriptionsPage,
│   │                      # InvoicesPage
│   ├── pharmacist/        # CheckInPage, PrescriptionQueuePage, PrescriptionDetailPage, InventoryPage
│   ├── admin/             # AdminDashboardPage, UsersPage, DoctorsPage, DepartmentsPage, MedicationsPage
│   └── home/              # LandingPage, RoleHome
├── hooks/useNotifications.ts
├── lib/                   # supabase, api.ts, availability.ts, utils.ts, queryClient.ts
└── types/index.ts
supabase/
├── migrations/            # 0001_schema.sql ... 0005_appointment_cancel_reason.sql
├── reset.sql              # reset database
└── apply_all.sql          # chạy tất cả migration một lần
```

## 12. Lưu ý triển khai

- Sau khi thay đổi schema, chạy `supabase/apply_all.sql` (sau `reset.sql`) để cập nhật cơ sở dữ liệu.
- Cron `mark-no-show` cần pg_cron; nếu tạo lại lịch trình trùng tên thì `select cron.unschedule('<job-name>')` trước.
- Tài khoản mới đăng ký có vai trò `patient`; cần admin nâng quyền qua trang Users & Roles để gán bác sĩ/dược sĩ/admin.
