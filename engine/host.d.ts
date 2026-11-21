/* Kiểu nền cho `this` trong các miền luật (engine/rules/*.js).
 * Các miền luật cài phương thức vào Game.prototype nên `this` là toàn bộ Game đã ghép; mức này chấp nhận
 * mọi thuộc tính để bắt lỗi biến chưa khai báo, sai toán tử và gọi sai chữ ký, rồi siết dần khi có kiểu cho từng miền. */
interface GameHost { [member: string]: any }

declare const process: any;
