export const investigationDashletTitles = {
  description: 'Description', contacts: 'Contacts', organizations: 'Organizations',
  publications: 'Publications', assays: 'Assays', studies: 'Studies', runs: 'Runs', workflows: 'Workflows', webview: 'Webview',
} as const
export type InvestigationDashletId = keyof typeof investigationDashletTitles
export const investigationDetailIds: readonly InvestigationDashletId[] = ['description', 'contacts', 'organizations', 'publications', 'assays', 'studies', 'runs', 'workflows']
