import { z } from "zod";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const emailSchema = z
  .string()
  .regex(emailRegex, "Vui lòng nhập email hợp lệ")
  .max(100, "Email không được quá 100 ký tự");

export const passwordSchema = z
  .string()
  .min(6, "Mật khẩu phải có ít nhất 6 ký tự")
  .max(100, "Mật khẩu không được quá 100 ký tự")
  .superRefine((value, ctx) => {
    const missing: string[] = [];
    if (!/[A-Z]/.test(value)) missing.push("1 chữ in hoa");
    if (!/[a-z]/.test(value)) missing.push("1 chữ thường");
    if (!/[^A-Za-z0-9]/.test(value)) missing.push("1 ký tự đặc biệt");
    if (missing.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Mật khẩu phải chứa ít nhất ${missing.join(", ")}`,
      });
    }
  });
