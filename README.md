# SkinPeek Mobile for Android 📱🎮

Ứng dụng Valorant Mobile Assistant toàn diện dành cho điện thoại Android, kết nối trực tiếp với Riot Client & Valorant API. 
Sở hữu giao diện Dark Glassmorphism cao cấp, tra cứu cửa hàng thời gian thực, xem kho đồ, kiểm tra lịch sử nạp Mezu và đặc biệt là tính năng **Pick & Khóa Tướng Từ Xa (Remote Agent Picker & Instalock)** khi ra ngoài.

Tác giả: **merrthereboy**  
Cộng đồng Discord chính thức: **[Tham gia Discord](https://discord.com/invite/z4jUC4v8W2)**

---

## 🌟 Tính Năng Nổi Bật

1. **Cửa Hàng Hàng Ngày (Daily Shop) & Chợ Đêm (Night Market)**:
   - 4 Skin hàng ngày cập nhật thời gian thực từ tài khoản Riot.
   - Hiển thị logo VP, giá bán, video xem trước hoạt ảnh cấp độ, hiệu ứng âm thanh và biến thể màu (Chromas).
   - Bộ sưu tập nổi bật (Featured Bundle): Xem chi tiết các vật phẩm, giá gốc, giá combo và mức tiết kiệm VP.
   - Cửa hàng Phụ Kiện (Accessory Store): Mua gun buddy, thẻ bài, bình sơn bằng Kingdom Credits (KC).
   - Chợ Đêm (Night Market): Cào thẻ tương tác với mức giảm giá từ 10% đến 49%.

2. **Kho Đồ & Thư Viện Tra Cứu Skin (Skin Library)**:
   - Xem toàn bộ skin súng, dao cận chiến, cấp độ hiện tại, thẻ người chơi (Player Cards).
   - **Thư viện Skin Valorant:** Tra cứu toàn bộ các skin súng trong game theo tên, loại vũ khí (Vandal, Phantom, Dao, Operator...) và phân hạng (Exclusive, Ultra, Premium...). Có video phát trực tiếp hoạt ảnh từng skin.

3. **Phòng Chờ Live & Tự Động Khóa Tướng (Remote Agent Pick & Instalock)**:
   - Hỗ trợ cả 2 chế độ: **Đấu Thường (Unrated)** và **Xếp Hạng (Competitive)**.
   - Nhận diện bản đồ thi đấu trực tiếp (Ascent, Icebox, Bind, Haven, Split, Sunset, Lotus, Abyss...).
   - Hiển thị tình trạng pick tướng của cả 5 thành viên đội (Đang chọn / Đã khóa).
   - Cho phép tự chọn tướng yêu thích từ xa ngay trên điện thoại hoặc cài đặt tự động khóa (Instalock) khi vào trận.
   - Tự động cập nhật 100% khi Riot ra mắt Đặc vụ mới!

4. **Định Giá Tài Khoản Chuẩn Mezu & Lịch Sử Nạp**:
   - Thống kê chi tiết cấp độ (Level), Rank thi đấu hiện tại (VD: Diamond 1 • 71 RR) và Peak Rank cao nhất.
   - Ước tính tổng số tiền đã nạp theo chuẩn Mezu (tỷ giá ZaloPay chính hãng).
   - Phân loại rõ ràng số lượng skin đã mua, skin Battlepass, skin nhận miễn phí.

5. **Cài Đặt & Tiện Ích**:
   - Bật / tắt ẩn số dư ví.
   - Đặt lịch hẹn Skin (Alert Skin / Wishlist).
   - 1-Chạm sao chép Riot ID.
   - Chuyển đổi song ngữ 🇻🇳 Tiếng Việt & 🇬🇧 English.
   - Tùy chỉnh địa chỉ Server IP để truy cập từ xa qua mạng nội bộ hoặc cloud.

---

## 🚀 Hướng Dẫn Tải & Cài Đặt File APK

### Cách 1: Tải APK tự động qua GitHub Actions (Khuyên Dùng)
1. Fork hoặc Push repository này lên tài khoản GitHub của bạn.
2. Trên giao diện GitHub, chuyển sang tab **Actions**.
3. Chọn workflow **"Build Android APK (SkinPeek Mobile)"** và bấm **Run workflow**.
4. Sau khoảng 2-3 phút, GitHub sẽ tự động biên dịch xong file APK. Bạn chỉ cần bấm vào kết quả chạy để tải trực tiếp file `SkinPeek-Valorant-Mobile.apk` về điện thoại và cài đặt!

### Cách 2: Cài Đặt Trực Tiếp Dạng PWA (Không cần cài APK)
1. Chạy server trên máy tính: `npm start`.
2. Mở trình duyệt Chrome trên điện thoại truy cập: `http://<IP-Máy-Tính>:3000` (VD: `http://192.168.1.205:3000`).
3. Bấm vào biểu tượng **3 chấm** ở góc trên cùng bên phải trình duyệt -> Chọn **"Thêm vào Màn hình chính" (Cài đặt ứng dụng)**.
4. Ứng dụng sẽ xuất hiện trên màn hình điện thoại với icon riêng và chạy toàn màn hình y hệt như app Native!

### Cách 3: Build APK Bằng Android Studio
```bash
# 1. Cài đặt các thư viện cần thiết
npm install

# 2. Đồng bộ mã nguồn giao diện vào Android
npx cap sync android

# 3. Mở Android Studio
npx cap open android
```
Trong Android Studio: Chọn **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)** để xuất file APK.

---

## 💻 Hướng Dẫn Chạy Server Cục Bộ (Localhost)

```bash
# Cài đặt dependencies
npm install

# Khởi chạy server
npm start
```
* Truy cập trên máy tính: `http://localhost:3000`
* Truy cập trên điện thoại (cùng mạng Wi-Fi): `http://192.168.1.205:3000`

---

## 📜 Bản Quyền & Tuyên Bố Miễn Trừ
* Ứng dụng được phát triển bởi **merrthereboy** dành cho cộng đồng game thủ Valorant.
* Valorant và các tài nguyên liên quan thuộc bản quyền của Riot Games, Inc. 
* Dự án dựa trên cơ chế reverse-engineering giao thức RSO client mã nguồn mở từ SkinPeek.
