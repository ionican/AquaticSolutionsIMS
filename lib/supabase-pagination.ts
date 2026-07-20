interface SupabasePage<T> {
  data: T[] | null
  error: { message: string } | null
}

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<SupabasePage<T>>,
  pageSize = 1000
): Promise<SupabasePage<T>> {
  const data: T[] = []

  for (let from = 0; ; from += pageSize) {
    const result = await fetchPage(from, from + pageSize - 1)

    if (result.error) {
      return { data: null, error: result.error }
    }

    const page = result.data || []
    data.push(...page)

    if (page.length < pageSize) {
      return { data, error: null }
    }
  }
}
