import { supabase } from '~/lib/supabase';
import type {
  Tables,
  TablesInsert,
  TablesUpdate,
} from '~/utils/database.types';

export type MembershipApplication = Tables<'membership_applications'>;
export type MembershipApplicationDraft =
  TablesInsert<'membership_applications'> &
    TablesUpdate<'membership_applications'>;

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

export async function fetchMembershipApplication(
  organizationId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from('membership_applications')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function upsertMembershipApplicationDraft(
  draft: MembershipApplicationDraft,
) {
  const { data, error } = await supabase
    .from('membership_applications')
    .upsert(
      {
        ...draft,
        status: 'draft',
      },
      {
        onConflict: 'organization_id,user_id',
      },
    )
    .select('*')
    .single();

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
