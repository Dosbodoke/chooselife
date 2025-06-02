import { z } from "zod";

export const notificationSchema = z.object({
  password: z.string().min(1, "Senha é obrigatória"),
  userId: z.string().optional(),
  titleEn: z.string().max(
    65,
    "Título em inglês deve ter no máximo 65 caracteres",
  ).optional(),
  titlePt: z.string().max(
    65,
    "Título em português deve ter no máximo 65 caracteres",
  ).optional(),
  bodyEn: z.string().max(
    150,
    "Mensagem em inglês deve ter no máximo 150 caracteres",
  ).optional(),
  bodyPt: z.string().max(
    150,
    "Mensagem em português deve ter no máximo 150 caracteres",
  ).optional(),
}).superRefine((data, ctx) => {
  // At least one Portuguese field is required
  if (!data.titlePt?.trim() && !data.bodyPt?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "É necessário preencher pelo menos um campo em português (título ou mensagem)",
      path: ["titlePt"],
    });
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "É necessário preencher pelo menos um campo em português (título ou mensagem)",
      path: ["bodyPt"],
    });
  }

  // At least one content field is required
  if (
    !data.titleEn?.trim() && !data.titlePt?.trim() && !data.bodyEn?.trim() &&
    !data.bodyPt?.trim()
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Pelo menos um campo de título ou mensagem deve ser preenchido",
      path: ["titleEn"],
    });
  }

  // Check combined length for English
  if (data.titleEn?.trim() || data.bodyEn?.trim()) {
    const combinedLength = (data.titleEn?.trim() || "").length +
      (data.bodyEn?.trim() || "").length;
    if (combinedLength > 150) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          `Título + mensagem em inglês muito longo (${combinedLength}/150 caracteres)`,
        path: ["titleEn"],
      });
    }
  }

  // Check combined length for Portuguese
  if (data.titlePt?.trim() || data.bodyPt?.trim()) {
    const combinedLength = (data.titlePt?.trim() || "").length +
      (data.bodyPt?.trim() || "").length;
    if (combinedLength > 150) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          `Título + mensagem em português muito longo (${combinedLength}/150 caracteres)`,
        path: ["titlePt"],
      });
    }
  }
});

export type NotificationFormData = z.infer<typeof notificationSchema>;
