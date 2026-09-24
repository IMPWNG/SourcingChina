import { z } from "zod";
import { COMPANY_TYPES } from "@/lib/domain";

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(200),
});

export const companySchema = z.object({
  name_zh: z.string().trim().max(300).optional().default(""),
  name_en: z.string().trim().max(300).optional().default(""),
  brand: z.string().trim().max(200).optional().default(""),
  company_type: z.enum(COMPANY_TYPES),
  address: z.string().trim().max(500).optional().default(""),
  city: z.string().trim().max(120).optional().default(""),
  province: z.string().trim().max(120).optional().default(""),
  country: z.string().trim().min(2).max(8).optional().default("CN"),
  website: z.string().trim().max(500).optional().default(""),
  wechat: z.string().trim().max(120).optional().default(""),
  phone: z.string().trim().max(200).optional().default(""),
  email: z.string().trim().max(200).optional().default(""),
  export_markets: z.string().trim().max(300).optional().default(""),
  notes: z.string().trim().max(5000).optional().default(""),
});

export const categorySchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase slug."),
  name_en: z.string().trim().min(2).max(80),
  name_zh: z.string().trim().max(80).optional().default(""),
});

export const familySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(400).optional().default(""),
  category_id: z.string().uuid().optional().or(z.literal("")),
});

export const certSchema = z.object({
  code: z.string().trim().min(2).max(40),
});

export const factorySchema = z.object({
  name: z.string().trim().min(2).max(200),
  address: z.string().trim().max(400).optional().default(""),
  city: z.string().trim().max(120).optional().default(""),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  title: z.string().trim().max(120).optional().default(""),
  phone: z.string().trim().max(80).optional().default(""),
  email: z.string().trim().max(200).optional().default(""),
  is_public: z.boolean().optional().default(false),
});

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;

export function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export function parseMarkets(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[,;]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}
