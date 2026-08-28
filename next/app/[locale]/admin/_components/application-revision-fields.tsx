"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/**
 * The immutable snapshot of what somebody attested to when they applied.
 *
 * Typed structurally rather than against one RPC's row, because two different
 * functions return this same shape: `get_initial_payment_claim_detail`, which is
 * addressed by claim, and `get_association_member_detail`, which is addressed by
 * person. Both drawers must render the form identically -- a field that only
 * appears on one of them is a field an admin cannot trust.
 */
export type ApplicationRevisionSnapshot = {
  full_name: string | null;
  birth_date: string | null;
  nationality: string | null;
  marital_status: string | null;
  profession: string | null;
  birthplace: string | null;
  cpf: string | null;
  id_document_number: string | null;
  id_document_issuer: string | null;
  postal_code: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  email: string | null;
  phone: string | null;
  blood_type: string | null;
  has_allergies: boolean | null;
  allergies: string | null;
  has_dietary_restrictions: boolean | null;
  dietary_restrictions: string | null;
  highline_experience: string | null;
  has_rescue_course: boolean | null;
  first_aid_course: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_phone: string | null;
};

export function DetailField({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium">{children || "—"}</dd>
    </div>
  );
}

export function ApplicationRevisionFields({
  handle,
  revision,
}: {
  handle: string | null;
  revision: ApplicationRevisionSnapshot;
}) {
  const t = useTranslations("admin");

  return (
    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      <DetailField label={t("initialReview.fullName")}>
        {revision.full_name}
      </DetailField>
      <DetailField label={t("initialReview.handle")}>{handle}</DetailField>
      <DetailField label={t("initialReview.birthDate")}>
        {revision.birth_date}
      </DetailField>
      <DetailField label={t("initialReview.nationality")}>
        {revision.nationality}
      </DetailField>
      <DetailField label={t("initialReview.maritalStatus")}>
        {revision.marital_status}
      </DetailField>
      <DetailField label={t("initialReview.profession")}>
        {revision.profession}
      </DetailField>
      <DetailField label={t("initialReview.birthplace")}>
        {revision.birthplace}
      </DetailField>
      <DetailField label={t("initialReview.email")}>{revision.email}</DetailField>
      <DetailField label={t("initialReview.phone")}>{revision.phone}</DetailField>
      <DetailField label={t("initialReview.cpf")}>{revision.cpf}</DetailField>
      <DetailField label={t("initialReview.idDocument")}>
        {revision.id_document_number}
      </DetailField>
      <DetailField label={t("initialReview.issuingAuthority")}>
        {revision.id_document_issuer}
      </DetailField>
      <DetailField label={t("initialReview.postalCode")}>
        {revision.postal_code}
      </DetailField>
      <DetailField label={t("initialReview.address")}>
        {revision.address_line}
      </DetailField>
      <DetailField label={t("initialReview.cityState")}>
        {[revision.city, revision.state].filter(Boolean).join(" / ")}
      </DetailField>
      <DetailField label={t("initialReview.bloodType")}>
        {revision.blood_type}
      </DetailField>
      {/* `has_allergies: false` is a real answer, not a missing one -- so it
          renders as "none reported" rather than falling through to an em dash. */}
      <DetailField label={t("initialReview.allergies")}>
        {revision.has_allergies ? revision.allergies : t("common.noneReported")}
      </DetailField>
      <DetailField label={t("initialReview.dietaryRestrictions")}>
        {revision.has_dietary_restrictions
          ? revision.dietary_restrictions
          : t("common.noneReported")}
      </DetailField>
      <DetailField label={t("initialReview.highlineExperience")}>
        {revision.highline_experience}
      </DetailField>
      <DetailField label={t("initialReview.rescueCourse")}>
        {revision.has_rescue_course ? t("common.yes") : t("common.no")}
      </DetailField>
      <DetailField label={t("initialReview.firstAidCourse")}>
        {revision.first_aid_course}
      </DetailField>
      <DetailField label={t("initialReview.emergencyContact")}>
        {[
          revision.emergency_contact_name,
          revision.emergency_contact_relationship,
          revision.emergency_contact_phone,
        ]
          .filter(Boolean)
          .join(" · ")}
      </DetailField>
    </div>
  );
}
