export const investigationDashletTitles = {
  description: 'Description', contacts: 'Contacts', organizations: 'Organizations',
  publications: 'Publications', assays: 'Assays', studies: 'Studies', webview: 'Webview',
} as const
export type InvestigationDashletId = keyof typeof investigationDashletTitles
export const investigationDetailIds: readonly InvestigationDashletId[] = ['description', 'contacts', 'organizations', 'publications', 'assays', 'studies']
