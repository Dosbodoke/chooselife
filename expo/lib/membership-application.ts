import { supabase } from '~/lib/supabase';
import type {
  Tables,
  TablesInsert,
  TablesUpdate,
} from '~/utils/database.types';

export type MembershipApplication = Tables<'membership_applications'>;

// `association_person_id` is the durable formal subject key and is NOT NULL, so
// the generated Insert type demands it. The client must never send it: a BEFORE
// INSERT trigger derives it from `user_id`, and that derivation is the only
// authority on which person a draft belongs to.
export type MembershipApplicationDraft = Omit<
  TablesInsert<'membership_applications'>,
  'association_person_id'
> &
  Omit<TablesUpdate<'membership_applications'>, 'association_person_id'>;

export type AssociationApplicationSubmission = {
  amount: number;
  application_revision_id: string;
  available_at: string;
  currency: string;
  obligation_id: string;
  obligation_status: 'available' | 'settled' | 'void';
  organization_id: string;
  payment_method: 'manual_pix';
  plan_type: 'monthly' | 'annual';
};

type ViaCepResponse = {
  bairro?: string;
  erro?: boolean;
  localidade?: string;
  logradouro?: string;
  uf?: string;
};

// A person is no longer limited to one application per organization: a refusal
// or a rejoin leaves `refused`/`admitted` history rows behind, and only the
// single row in an open status is addressable. That open row is the one the
// partial unique index on (organization_id, association_person_id) protects.
const OPEN_APPLICATION_STATUSES = ['draft', 'submitted'] as const;

export async function fetchMembershipApplication(
  organizationId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from('membership_applications')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .in('status', OPEN_APPLICATION_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data;
}

async function findOpenApplicationDraftId(
  organizationId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from('membership_applications')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return data?.id ?? null;
}

// The total unique constraint this used to arbitrate on
// (organization_id, user_id) is gone. Its replacement is a PARTIAL unique
// index, which Postgres refuses as an `ON CONFLICT (cols)` arbiter unless the
// statement restates the index predicate — something supabase-js cannot emit —
// so the target row is resolved with an explicit read before the write.
//
// Only a `draft` row is updated. Reverting a `submitted` application to draft
// is not the model (and the owner UPDATE policy forbids it): a correction is a
// brand new application, submitted through `submit_association_application`.
export async function upsertMembershipApplicationDraft(
  draft: MembershipApplicationDraft,
) {
  const { organization_id: organizationId, user_id: userId } = draft;

  if (!organizationId || !userId) {
    throw new Error(
      'A membership application draft needs both an organization and a subject.',
    );
  }

  const openDraftId = await findOpenApplicationDraftId(organizationId, userId);
  const payload = { ...draft, status: 'draft' as const };

  const { data, error } = await (openDraftId
    ? supabase
        .from('membership_applications')
        .update(payload)
        .eq('id', openDraftId)
        .select('*')
        .single()
    : supabase
        .from('membership_applications')
        // The generated Insert type requires `association_person_id`; the
        // BEFORE INSERT trigger is what actually fills it, from `user_id`.
        .insert(payload as TablesInsert<'membership_applications'>)
        .select('*')
        .single());

  if (error) throw error;

  return data;
}

export async function submitAssociationApplication({
  applicationId,
  draftVersion,
  organizationId,
  planType,
  termsVersion,
}: {
  applicationId: string;
  draftVersion: number;
  organizationId: string;
  planType: 'monthly' | 'annual';
  termsVersion: string;
}): Promise<AssociationApplicationSubmission | null> {
  const { data, error } = await supabase.rpc('submit_association_application', {
    p_application_id: applicationId,
    p_draft_version: draftVersion,
    p_organization_id: organizationId,
    p_plan_type: planType,
    p_terms_version: termsVersion,
  });

  if (error) throw error;

  return (data?.[0] as AssociationApplicationSubmission | undefined) ?? null;
}

export async function fetchAddressByCep(cep: string) {
  const digits = cep.replace(/\D/g, '');

  if (digits.length !== 8) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as ViaCepResponse;

    if (data.erro) {
      return null;
    }

    return {
      address_line: [data.logradouro, data.bairro].filter(Boolean).join(', '),
      city: data.localidade ?? '',
      state: data.uf ?? '',
    };
  } finally {
    clearTimeout(timeout);
  }
}
