import { z } from "zod"

type NumberAsStringOptions = {
    numberType: "integer" | "float"
    acceptZero: boolean
    positiveOnly: boolean
} & (
    | { required: true; requiredMessage?: string }
    | { required: false; requiredMessage?: undefined }
)

export const numberAsString = ({
    numberType,
    acceptZero,
    required,
    requiredMessage,
    positiveOnly
}: NumberAsStringOptions) => {
    return z.string().superRefine((val, ctx) => {
        // Empty value and optional field
        if (val === "" && !required) {
            return
        }

        // Empty value and required field
        if (val === "" && required) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: requiredMessage ?? "Campo obrigatório"
            })
            return
        }

        const numberValue = Number(val)

        // Validate if number is negative
        if (numberValue < 0 && positiveOnly) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "O valor deve ser positivo"
            })
            return
        }

        // Validate if should't accept zero
        if (numberValue === 0 && !acceptZero) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "O valor não pode ser zero"
            })
            return
        }

        const decimalPlaces = val.includes(".") ? val.split(".")[1].length : 0
        // Validate if shouldn't have decimal places
        if (decimalPlaces > 0 && numberType === "integer") {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Número deve ser inteiro"
            })
            return
        }
    })
}
