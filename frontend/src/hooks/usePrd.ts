import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { prds, type ListPrdsParams } from '@/lib/api'
import type { Prd, PrdListResponse, PrdStatus, UpdatePrdRequest } from '@/lib/types'

/**
 * Query keys.
 *
 * Centralised so invalidation cannot drift from the keys actually in use -
 * a mistyped key elsewhere is a cache that silently never refreshes.
 */
export const prdKeys = {
  all: ['prds'] as const,
  lists: () => [...prdKeys.all, 'list'] as const,
  list: (params: ListPrdsParams) => [...prdKeys.lists(), params] as const,
  details: () => [...prdKeys.all, 'detail'] as const,
  detail: (id: string) => [...prdKeys.details(), id] as const,
}

export interface UsePrdListParams {
  search?: string
  status?: PrdStatus
  limit?: number
  offset?: number
}

/** The dashboard list. */
export function usePrdList(params: UsePrdListParams = {}): UseQueryResult<PrdListResponse> {
  return useQuery({
    queryKey: prdKeys.list(params),
    queryFn: ({ signal }) => prds.list(params, signal),
    // Keeps the previous page visible while a new search resolves, so the
    // list does not blink to empty on every keystroke.
    placeholderData: (previous) => previous,
  })
}

/** One PRD in full. */
export function usePrd(id: string | undefined) {
  return useQuery({
    queryKey: prdKeys.detail(id ?? 'none'),
    queryFn: ({ signal }) => prds.get(id!, signal),
    enabled: Boolean(id),
  })
}

export function useCreatePrd() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: (title?: string) => prds.create(title ? { title } : {}),
    onSuccess: (created) => {
      queryClient.setQueryData(prdKeys.detail(created.id), created)
      void queryClient.invalidateQueries({ queryKey: prdKeys.lists() })
      navigate(`/prds/${created.id}/edit?step=1`)
    },
    onError: () => toast.error("Couldn't create that PRD. Please try again."),
  })
}

export function useUpdatePrd(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (patch: UpdatePrdRequest) => prds.update(id, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(prdKeys.detail(id), updated)
      void queryClient.invalidateQueries({ queryKey: prdKeys.lists() })
    },
  })
}

/** Rename, with an optimistic update so the title changes instantly. */
export function useRenamePrd() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      prds.update(id, { title }),
    onMutate: async ({ id, title }) => {
      await queryClient.cancelQueries({ queryKey: prdKeys.lists() })
      const previous = queryClient.getQueriesData<PrdListResponse>({
        queryKey: prdKeys.lists(),
      })

      queryClient.setQueriesData<PrdListResponse>(
        { queryKey: prdKeys.lists() },
        (old) =>
          old && {
            ...old,
            items: old.items.map((item) =>
              item.id === id ? { ...item, title } : item,
            ),
          },
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      // Put the old titles back rather than leaving a rename that did not save.
      context?.previous?.forEach(([key, data]) => queryClient.setQueryData(key, data))
      toast.error("Couldn't rename that PRD.")
    },
    onSettled: (_data, _error, { id }) => {
      void queryClient.invalidateQueries({ queryKey: prdKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: prdKeys.detail(id) })
    },
  })
}

export function useDuplicatePrd() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => prds.duplicate(id),
    onSuccess: (copy) => {
      void queryClient.invalidateQueries({ queryKey: prdKeys.lists() })
      toast.success(`Duplicated as "${copy.title}".`)
    },
    onError: () => toast.error("Couldn't duplicate that PRD."),
  })
}

export function useDeletePrd() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => prds.remove(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: prdKeys.lists() })
      const previous = queryClient.getQueriesData<PrdListResponse>({
        queryKey: prdKeys.lists(),
      })

      // Remove it immediately; deletion is confirmed, so waiting for the
      // round trip just makes the UI feel broken.
      queryClient.setQueriesData<PrdListResponse>(
        { queryKey: prdKeys.lists() },
        (old) =>
          old && {
            ...old,
            items: old.items.filter((item) => item.id !== id),
            total: Math.max(0, old.total - 1),
          },
      )
      return { previous }
    },
    onError: (_error, _id, context) => {
      context?.previous?.forEach(([key, data]) => queryClient.setQueryData(key, data))
      toast.error("Couldn't delete that PRD.")
    },
    onSuccess: () => toast.success('PRD deleted.'),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: prdKeys.lists() })
    },
  })
}

/** Convenience for components that only need the cached detail record. */
export function usePrdFromCache(id: string): Prd | undefined {
  const queryClient = useQueryClient()
  return queryClient.getQueryData<Prd>(prdKeys.detail(id))
}
