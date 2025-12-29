import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, type SubmitHandler, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';

import { useSupabase } from '../../supabase-provider';
import { STRENGTH_CLASS_OPTIONS } from './types';

// ============================================================================
// Schema Definitions
// ============================================================================

/**
 * Base webbing schema for form inputs
 * length is a string that gets parsed to number on submit
 */
export const webbingSchema = z.object({
  length: z.string().min(1, 'Length is required').refine(
    (val) => {
      const num = parseInt(val, 10);
      return !isNaN(num) && num > 0;
    },
    { message: 'Length must be a positive number' }
  ),
  leftLoop: z.boolean(),
  rightLoop: z.boolean(),
});

/**
 * Extended schema for webbing registration
 */
export const registerWebbingSchema = webbingSchema.extend({
  modelID: z.string().optional(),
  note: z.string(),
  tagName: z.string().min(1, 'Tag name is required'),
  strengthClass: z.enum(STRENGTH_CLASS_OPTIONS).optional(),
});

export type WebbingFormData = z.infer<typeof webbingSchema>;
export type RegisterWebbingFormData = z.infer<typeof registerWebbingSchema>;

// ============================================================================
// Hook
// ============================================================================

export interface UseRegisterWebbingOptions {
  /**
   * Callback that runs after query invalidation on successful registration
   */
  onSuccess?: () => void;
}

export interface UseRegisterWebbingReturn {
  form: UseFormReturn<RegisterWebbingFormData>;
  mutation: ReturnType<typeof useMutation<void, Error, RegisterWebbingFormData>>;
  handleSubmit: () => void;
  isLoading: boolean;
}

/**
 * Hook for webbing registration form logic
 * Provides form state, mutation, and submit handler
 */
export function useRegisterWebbing(
  options?: UseRegisterWebbingOptions
): UseRegisterWebbingReturn {
  const { supabase, userId } = useSupabase();
  const queryClient = useQueryClient();

  const form = useForm<RegisterWebbingFormData>({
    resolver: zodResolver(registerWebbingSchema),
    mode: 'onChange',
    defaultValues: {
      modelID: '',
      note: '',
      tagName: '',
      length: '',
      leftLoop: false,
      rightLoop: false,
      strengthClass: undefined,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: RegisterWebbingFormData) => {
      if (!userId) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('webbing')
        .insert({
          model: data.modelID ? +data.modelID : undefined,
          description: data.note,
          tag_name: data.tagName,
          user_id: userId,
          left_loop: data.leftLoop,
          right_loop: data.rightLoop,
          length: +data.length,
          // Only save strength_class if no model is selected (custom webbing)
          strength_class: data.modelID ? undefined : data.strengthClass,
        })
        .single();

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate webbings query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['webbings'] });
      // Call user's onSuccess callback
      options?.onSuccess?.();
    },
  });

  const onSubmit: SubmitHandler<RegisterWebbingFormData> = async (data) => {
    await mutation.mutateAsync(data);
  };

  return {
    form,
    mutation,
    handleSubmit: form.handleSubmit(onSubmit),
    isLoading: mutation.isPending,
  };
}
