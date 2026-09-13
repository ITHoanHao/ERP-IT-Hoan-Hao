# Nhật ký phát triển ERP Lite — IT Hoàn Hảo

> **Lưu ý:** Tài liệu này do Claude tự tổng hợp lại từ trí nhớ cuộc trò chuyện để bạn (hoặc Claude ở phiên/tài khoản khác) nắm nhanh toàn bộ quá trình. **Nguồn chính xác nhất luôn là chính code + file `README.md`** đi kèm trong file zip bản mới nhất (hiện tại: **v7.2**).
>
> **Cập nhật lần này (v7.2):** tài liệu được viết lại để chuyển giao sang **tài khoản Claude khác** (Châu chuyển việc). Đã gộp toàn bộ tiến triển tới hiện tại — gồm module Wizard "Tạo đơn hàng", trang Trợ giúp, sửa lỗi Báo giá, tính năng xóa chuỗi Đơn mua hàng, và công cụ quét dữ liệu cũ (đã xây xong bước 1, đang chờ chạy thử trên dữ liệu thật).

---

## PHẦN 1 — TỔNG QUAN HỆ THỐNG

- **Công nghệ:** Node.js + Express + SQLite (better-sqlite3) + EJS + Bootstrap 5, PDF qua pdfkit, đọc PDF qua pdf-parse, xuất Excel qua exceljs (mới thêm ở v7.2, dùng cho công cụ nhập liệu hàng loạt)
- **Chạy ở đâu:** Local trên máy Windows của Châu, khởi động bằng `start.bat`
- **Dữ liệu lưu ở đâu:** `C:\Users\<tên máy>\ERPLiteData\` — **tách biệt hoàn toàn khỏi thư mục code**, để nâng cấp chỉ cần giải nén bản mới, không cần copy file tay
- **Đăng nhập:** 1 tài khoản admin dùng chung (username=admin), mật khẩu tự đặt. Bảng `users` trong DB đã hỗ trợ sẵn nhiều tài khoản nếu sau này cần tách theo từng nhân viên, nhưng **hiện tại cố ý chưa làm** (Châu đã chọn giữ 1 tài khoản chung khi bàn về tính năng Wizard).

---

## PHẦN 2 — DANH SÁCH MODULE (tính năng hiện có)

### A. Quy trình bán hàng (module gốc)
Khách hàng, Nhà cung cấp, Sản phẩm, Kho → Báo giá → Đơn bán (chốt cứng) → Đơn mua hàng → Nhập hàng → Giao hàng (tự tạo Hóa đơn) → Thu/Chi.
- Xuất PDF: Báo giá (cột Ghi chú riêng, icon tick vàng vẽ vector), Biên bản bàn giao (giá đã gồm VAT), Đề nghị thanh toán (tách riêng dòng thuế)
- Đính kèm hóa đơn điện tử (PDF **và XML**), OCR tự đọc số hóa đơn (đọc bằng regex trên text PDF, không phải OCR ảnh)
- Công cụ "Tính đơn giá từ tổng tiền mong muốn"
- Gõ tìm kiếm (Tom Select) ở mọi ô chọn; bộ lọc kiểu Excel cho License/Hợp đồng
- Modal "+ Thêm nhà cung cấp/sản phẩm mới..." ngay trong lúc lập chứng từ, không cần rời màn hình
- PDF tải trực tiếp về máy, không mở tab Chrome trống

### A.1. 🆕 Wizard "Tạo đơn hàng" (v7.2 — tính năng mới quan trọng nhất phiên này)
- Nút to **"Tạo đơn hàng"** trên Dashboard + đầu menu → màn hình **stepper hướng dẫn từng bước**, đúng 8 bước: Tạo báo giá → Gửi khách → Khách chốt → Đơn mua hàng (NCC) → Nhận hàng → Giao hàng → Hóa đơn & chứng từ → Ghi nhận thanh toán
- Mục tiêu: để **nhân viên** (không chỉ Châu) thao tác được mà không cần nhớ quy trình — mỗi lúc chỉ có 1 nút xanh để bấm
- **Tự động bỏ qua** bước Đơn mua hàng + Nhận hàng nếu sản phẩm đã đủ tồn kho sẵn có
- **Chặn cứng 2 lớp không cho nhảy bước:**
  - Giao diện: bước sau bị khóa cho tới khi bước trước xong
  - Máy chủ: các route tạo Đơn mua/Nhận hàng/Giao hàng/Hóa đơn/Thanh toán đều kiểm tra điều kiện bước trước (phần lớn tận dụng logic tồn kho/trạng thái đã có sẵn, ví dụ giao hàng sẽ bị từ chối với lỗi "Không đủ tồn kho" nếu cố tình bỏ qua bước mua/nhận hàng)
- Kỹ thuật: **không tạo bảng mới** — tính trạng thái wizard dựa hoàn toàn trên dữ liệu đã có (quotations/sales_orders/purchase_orders/goods_receipts/deliveries/invoices/payments), qua module `lib/wizardState.js`. Các route hiện có (`quotations.js`, `purchaseOrders.js`, `goodsReceipts.js`, `deliveries.js`, `invoices.js`, `payments.js`) đều được sửa nhẹ để hỗ trợ tham số `?wizard=<id>` — khi có tham số này, sau khi lưu sẽ **redirect quay lại đúng màn hình wizard** thay vì trang chi tiết thông thường
- Menu "Quy trình bán hàng" cũ (Báo giá/Đơn bán/Đơn mua... tách rời) **vẫn giữ nguyên đầy đủ** — dùng để tra cứu lịch sử hoặc xử lý ngoại lệ (VD mua văn phòng phẩm không liên quan đơn bán nào). Đây là quyết định có chủ đích của Châu, không phải thiếu sót.
- Trang danh sách `/wizard` hiển thị các đơn đang xử lý dở, bấm "Tiếp tục →" để quay lại đúng bước
- **Lỗi đã gặp & sửa lúc xây dựng:** ban đầu tính "Bỏ qua"/"Xong" của bước Đơn mua hàng/Nhận hàng dựa trên **tồn kho hiện tại** — sau khi nhận hàng xong, tồn kho lúc đó tự nhiên "đủ" nên bị hiện nhầm "Bỏ qua" dù thực ra đã làm rồi. Đã sửa: ưu tiên kiểm tra "đã có Đơn mua hàng thật chưa" (`pos.length > 0`) trước, chỉ xét tồn kho khi thực sự chưa có PO nào.

### A.2. 🆕 Xóa toàn bộ chuỗi liên quan — Đơn mua hàng (v7.2)
- Trước đây: đơn mua hàng đã có phiếu Nhận hàng thì **không xóa được** (lỗi FOREIGN KEY, không rõ nguyên nhân với người dùng)
- Đã thêm nút "Xóa toàn bộ chuỗi liên quan" (giống cơ chế đã có ở Báo giá) — yêu cầu mật khẩu quản trị viên
- **Tự kiểm tra an toàn trước khi xóa:** nếu hàng nhận về đã bị **dùng đi** (giao cho khách — serial đổi trạng thái khác `in_stock`, hoặc lô hàng theo số lượng bị trừ bớt) → **từ chối xóa**, báo rõ lý do, không cho xóa liều làm sai lệch dữ liệu
- Nếu hàng chưa bị dùng → xóa Đơn mua hàng + phiếu Nhận hàng + phiếu chi liên quan (nếu có), **hoàn tác tồn kho** đã cộng vào
- Đã kiểm thử qua `curl` thực tế cả 3 kịch bản: xóa an toàn thành công / bị chặn đúng khi hàng đã dùng / sai mật khẩu bị từ chối

### A.3. 🆕 Trang Trợ giúp & Hướng dẫn sử dụng (v7.2)
- Icon "?" cạnh icon bánh răng (⚙️) trên thanh menu → `/help`
- Hiện số phiên bản hiện tại + nhật ký thay đổi ngắn gọn (đọc từ `lib/version.js` — **nhớ cập nhật file này mỗi khi ra bản mới**)
- Hướng dẫn sử dụng Wizard bằng sơ đồ luồng trực quan (vẽ bằng CSS/HTML thuần, không phải ảnh chụp thật — Claude không có quyền truy cập giao diện máy Châu để chụp ảnh thật, nếu muốn ảnh thật cần Châu tự chụp gửi lại)
- Có phần giải thích các menu khác dùng khi nào + FAQ

### B. Quản lý License (bán cho khách hàng)
- Gia hạn = tạo bản ghi mới, giữ lịch sử bản cũ
- Hỗ trợ **Microsoft** (Tenant) và **Autodesk** (Contract ID, Subscription ID) — lưu theo từng License (không theo khách hàng)
- Xuất PDF "Thông tin đặt hàng" riêng cho từng nhà cung cấp

### C. Hợp đồng (công ty IT, khách hàng B2B)
- Tự hiện nút "Tạo hợp đồng" trên Đơn bán khi giá trị > 20 triệu
- Mẫu hợp đồng ngắn gọn 8 điều (theo mẫu KTC) — Bên A = IT Hoàn Hảo (bán), Bên B = khách hàng (mua)
- Địa điểm giao hàng + SĐT người nhận, tiến độ thanh toán tùy chỉnh, bảng giá đã gồm VAT
- Đính kèm bản đã ký/scan

### D. Theo dõi đơn hàng + Chuông thông báo (trung tâm điều phối bị động)
5 bước: Báo giá → Đặt hàng NCC → Giao hàng → Làm chứng từ → Ghi nhận thanh toán. Đây là trang **giám sát/nhắc nhở** (khác với Wizard là trang **hành động/dẫn dắt**) — cả 2 cùng tồn tại song song, phục vụ mục đích khác nhau.
Chuông thông báo gộp: báo giá quá 3 ngày, đơn chưa đặt NCC (có kiểm tra tồn kho thật), giao hàng chưa xuất hóa đơn, quá hạn thanh toán, License sắp hết hạn, Hợp đồng thuê trọ sắp hết hạn.

### E. Tổng vụ — Nhân sự + Tài sản (nội bộ IT Hoàn Hảo)
- Nhân viên: ngày sinh, trình độ học vấn, chức vụ/chi nhánh, ngân hàng, **lương ẨN cần mật khẩu**, đính kèm hồ sơ
- Tài sản: mã tự sinh, khấu hao tự động, gán cho nhân viên, đính kèm hóa đơn mua

### F. Quản lý nhà trọ (module riêng biệt, không liên quan ERP công ty IT)
- 7 phòng, quy tắc điện/nước/máy giặt/phí quản lý riêng từng phòng
- Hợp đồng thuê trọ theo **PHÒNG** (1 hợp đồng = tất cả người ở chung phòng cùng ký)
- Nhắc gia hạn/chấm dứt trước 1 tháng
- Chi phí vận hành hàng tháng → tính Lợi nhuận

### G. Gửi email cho khách hàng (soạn tự động)
- Mở Outlook classic đã điền sẵn To/CC/tiêu đề, để trống chữ ký cho Outlook tự chèn

### H. Bảo mật & tiện ích dùng chung
- Ẩn số liệu tài chính Dashboard, cần mật khẩu
- Xóa file đính kèm (mọi module) — cần mật khẩu
- Danh sách mở rộng dùng chung: Nhóm SP, Thương hiệu, Đơn vị tính, Chức vụ, Chi nhánh, Ngân hàng

### I. 🔧 Công cụ Nhập liệu hàng loạt dữ liệu quá khứ (đang làm dở — xem PHẦN 6)
- `tools/legacy-import/scan.js` — quét thư mục chứng từ cũ (Báo giá/Hóa đơn/BBBG/ĐNTT), tự đọc dữ liệu, xuất ra file Excel để rà soát. **Đã xây xong và test thành công trên bộ mẫu 8 đơn thật** (0 dòng lỗi). **Chưa xây bước 2** (đọc lại Excel đã rà soát để nhập chính thức vào hệ thống — bảng `legacy_orders` riêng biệt, không ảnh hưởng báo cáo doanh thu hiện tại theo đúng quyết định của Châu).

---

## PHẦN 3 — NHẬT KÝ THEO PHIÊN BẢN (tóm tắt các mốc quan trọng)

| Bản | Nội dung chính |
|---|---|
| v1.0–v3.8 | Xây dựng lõi ERP: danh mục, quy trình bán hàng, mua hàng, kho, VAT làm tròn từng dòng, danh sách động, License/Hợp đồng bản đầu |
| v3.9–v4.4 | Chuông thông báo + Theo dõi đơn hàng ra đời; License hỗ trợ Autodesk; sửa lỗi lớn: end-user License chuyển từ lưu theo khách hàng sang lưu theo từng License |
| v5.0–v5.2 | Module Nhà trọ ra đời; BBBG sửa hiện đúng giá gồm VAT |
| v5.3–v5.6 | Module Tổng vụ; gửi email tự động cho khách |
| v5.7–v5.9 | Xóa file đính kèm có mật khẩu; bộ lọc kiểu Excel; Hợp đồng thuê trọ ra đời (bản đầu, theo từng người) |
| v6.0 | Sửa lỗi nghiêm trọng: Báo giá nhiều dòng chỉ hiện 1 dòng (lỗi tồn tại từ v3.8) |
| v6.1 | Tái cấu trúc lớn: Hợp đồng thuê trọ đổi từ theo từng người sang theo PHÒNG |
| v6.2–v6.5 | Sửa nhiều lỗi nhỏ (thông tin chủ nhà trọ, năm bị lưu sai, ký tự tab trong PDF, xóa chuỗi bỏ sót Hợp đồng) |
| v6.6–v6.7 | Đổi hoàn toàn mẫu Hợp đồng công ty sang bản 8 điều theo mẫu KTC |
| v6.8–v6.9 | Thêm cột "Ghi chú" cho Báo giá; sửa icon tick bằng vẽ vector thay vì emoji |
| v7.0 | Sửa lỗi nghiêm trọng (regression): bảng ghi chú dài làm vỡ layout PDF; PDF tải trực tiếp thay vì mở tab mới |
| v7.1 | Sửa lỗi không lưu được "Ngày ký" khi sửa Hợp đồng |
| **v7.2** | **(Phiên này)** Sửa lỗi không thêm được sản phẩm mới trong Báo giá (thẻ `</script>` đóng dư thừa); xây dựng module Wizard "Tạo đơn hàng" hướng dẫn 8 bước có chặn cứng; thêm trang Trợ giúp/Hướng dẫn sử dụng; thêm "Xóa toàn bộ chuỗi liên quan" cho Đơn mua hàng; xây dựng (chưa hoàn thiện) công cụ quét & nhập liệu hàng loạt dữ liệu quá khứ |

---

## PHẦN 4 — QUYẾT ĐỊNH THIẾT KẾ QUAN TRỌNG (cần nhớ khi mở rộng thêm)

| Chủ đề | Quyết định |
|---|---|
| Làm tròn VAT | Làm tròn **từng dòng** (thành tiền + thuế) trước khi cộng tổng — khớp cách hóa đơn điện tử VN tính |
| Vị trí lưu dữ liệu | Ngoài thư mục code (`ERPLiteData`), nâng cấp không cần copy tay |
| Gia hạn (License/Hợp đồng thuê trọ) | Luôn tạo **bản ghi mới**, giữ bản cũ — không sửa đè |
| File đính kèm | 1 bảng `attachments` chung, phân biệt qua `entity_type` + `label` |
| Mật khẩu bảo vệ | Dùng lại đúng mật khẩu đăng nhập admin |
| Module Nhà trọ | Tách biệt hoàn toàn dữ liệu với ERP công ty IT |
| Hợp đồng thuê trọ | Theo **PHÒNG**, không theo từng cá nhân (từ v6.1) |
| PDF export | Luôn `Content-Disposition: attachment` (tải file), không `inline` — từ v7.0 |
| Test PDF/JS | Không chỉ test qua `curl` (không chạy JS) — dùng thêm mô phỏng trình duyệt thật (jsdom) cho lỗi client-side |
| **Wizard vs Menu cũ** | **(v7.2)** Wizard chỉ là **lối tắt/hướng dẫn thêm**, KHÔNG thay thế hay ẩn menu "Quy trình bán hàng" cũ — quyết định có chủ đích của Châu để giữ đường xử lý ngoại lệ |
| **Chặn cứng quy trình** | **(v7.2)** Khi làm tính năng có tính "bắt buộc đúng thứ tự", phải chặn ở **cả giao diện lẫn máy chủ** — không tin tưởng riêng lớp giao diện |
| **Đăng nhập nhân viên** | **(v7.2)** Châu đã chọn **CHƯA cần** tách tài khoản riêng từng nhân viên — vẫn dùng chung 1 tài khoản admin. Bảng `users` đã hỗ trợ sẵn nếu sau này đổi ý. |
| **Dữ liệu lịch sử nhập hàng loạt** | **(v7.2, đang làm)** Châu đã chọn: dữ liệu cũ nhập vào **KHÔNG cộng vào báo cáo doanh thu/lợi nhuận hiện tại** — để riêng một mục tách biệt, chỉ để lưu trữ + tra cứu lại chứng từ. Mỗi hóa đơn tách trong 1 đơn (VD 1 đơn có hóa đơn máy + hóa đơn phần mềm riêng) → tách thành nhiều dòng riêng, không gộp. |

---

## PHẦN 5 — LỖI QUAN TRỌNG ĐÃ PHÁT HIỆN & SỬA (đáng nhớ để tránh lặp lại)

1. **v4.4** — License: end-user lưu theo khách hàng gây ghi đè sai khi 1 khách có nhiều end-user khác nhau
2. **v5.9** — Tên phòng có dấu tiếng Việt làm hỏng header HTTP khi xuất PDF
3. **v6.0** — Báo giá nhiều dòng chỉ hiện 1 dòng: script tải dữ liệu chạy trước khi thư viện tìm kiếm sản phẩm kịp tải
4. **v6.3** — Năm bị lưu sai (0027 thay vì 2027) do trình duyệt không tự thêm đủ số 0
5. **v6.4** — Ký tự tab (`\t`) trong PDF hợp đồng hiện thành ô vuông (PDFKit không hỗ trợ tab)
6. **v6.5** — "Xóa toàn bộ chuỗi liên quan" bỏ sót không xóa Hợp đồng, để lại bản ghi "mồ côi"
7. **v6.9** — Emoji dán vào ghi chú hiện thành ô vuông xấu — sửa bằng tự vẽ icon vector
8. **v7.0** — Icon tick vẽ bằng `save()`/`restore()` không an toàn qua `addPage()`, làm "rò" màu cam sang chữ phía sau
9. **v7.1** — Route lưu sửa Hợp đồng bị sót cập nhật trường "Ngày ký"
10. **v7.2** — Thẻ `</script>` bị đóng dư thừa giữa chừng trong `views/quotations/form.ejs`, khiến 2 hàm xử lý "Thêm sản phẩm mới" (`handleProductSelect`, `submitQuickAddProduct`) nằm ngoài script, hiện ra như văn bản thô thay vì chạy được — do lỗi gõ nhầm khi thêm tính năng modal thêm nhanh sản phẩm ở phiên trước
11. **v7.2** — Logic Wizard: tính trạng thái "Bỏ qua"/"Xong" bước Đơn mua hàng dựa theo tồn kho **hiện tại** thay vì **tại thời điểm chốt đơn**, khiến sau khi nhận hàng xong bị hiện nhầm "Bỏ qua" — đã sửa bằng cách ưu tiên kiểm tra đã có PO thật hay chưa trước khi xét tồn kho

---

## PHẦN 6 — VIỆC ĐANG TREO / CHƯA QUYẾT ĐỊNH XONG

1. **Triển khai VPS**: Châu đang bàn với bên kỹ thuật riêng, chưa chốt phương án.
2. **Lưu trữ tự động lên Google Drive**: tạm gác, chờ quyết định VPS trước.
3. **Gửi email tự động hoàn toàn** (đính kèm sẵn, không cần kéo-thả tay): cần SMTP/Graph API M365, có rủi ro chính sách bảo mật tenant — chưa triển khai.
4. **🔄 ĐANG LÀM: Nhập liệu hàng loạt dữ liệu quá khứ (2024–nay, 200+ đơn)**
   - Đã thống nhất: chỉ cần bản tóm tắt (khách hàng/NCC, tổng tiền, ngày) + đính kèm file PDF gốc, không cần chi tiết từng dòng sản phẩm
   - **Đã hoàn thành:** công cụ `tools/legacy-import/scan.js` — quét thư mục, ưu tiên đọc XML hóa đơn điện tử (chính xác tuyệt đối), dự phòng đọc PDF bằng regex khi không có XML, tự nhận diện Bán/Mua dựa vào việc thư mục có kèm Báo giá/BBBG/ĐNTT hay không (đáng tin hơn đọc nội dung PDF vì PDF tự xuất của IT Hoàn Hảo bị lỗi thứ tự đọc nhãn/giá trị khi qua `pdf-parse`). Đã test trên 8 chứng từ mẫu thật — 0 lỗi.
   - **Bước tiếp theo cần làm:**
     1. Châu chạy `node tools/legacy-import/scan.js "đường-dẫn-thư-mục-200+-đơn"` trên **toàn bộ dữ liệu thật**, xem tỷ lệ đọc đúng
     2. Gửi lại kết quả + các dòng "Cần kiểm tra" để tinh chỉnh thêm nếu cần
     3. Xây **bước 2** (chưa làm): tính năng đọc lại file Excel đã rà soát → tạo bảng `legacy_orders` mới (tách biệt hoàn toàn khỏi báo cáo doanh thu hiện tại theo đúng quyết định) → đính kèm chứng từ gốc → có trang danh sách riêng để xem lại

---

## PHẦN 7 — CÁCH BẮT ĐẦU LẠI VỚI CLAUDE Ở TÀI KHOẢN/CHAT MỚI

1. Gửi file **`erp-lite-ithoanhao-v7_2.zip`** (bản mới nhất) + file nhật ký này (`NHAT_KY_PHAT_TRIEN_ERP_LITE.md`).
2. Nói rõ: "Đây là hệ thống ERP Lite tôi đã phát triển cùng Claude qua nhiều tháng — code + nhật ký đính kèm đã ghi đầy đủ lịch sử, hãy đọc kỹ trước khi làm tiếp."
3. Nếu tiếp tục việc "Nhập liệu hàng loạt" (Phần 6, mục 4), nói rõ đã làm tới đâu (công cụ scan.js đã xong, đang chờ chạy trên dữ liệu thật hoặc đang chờ xây bước 2), gửi kèm kết quả file Excel đã scan (nếu có) hoặc các file mẫu chứng từ cũ.
4. Nếu có vấn đề phát sinh khi dùng thử Wizard hoặc tính năng "Xóa chuỗi liên quan" Đơn mua hàng (2 tính năng mới nhất, mới test qua `curl` mô phỏng chứ chưa test bằng thao tác chuột thật), chụp màn hình gửi kèm mô tả lỗi.
