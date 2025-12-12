function getSortValue(item: EnrichedMediaItem, key: SortKey): string | number {
  switch (key) {
    case 'folderPath':
      return item.folderPath ?? '';
    case 'name':
      return item.name ?? '';
    case 'mimeType':
      return item.mimeType ?? '';
    case 'status':
      return String(item.status ?? '');
    case 'size':
      return item._enriched.sizeNum;
    case 'createdAt':
      return item._enriched.createdAtTime;
    case 'state':
      return STATE_PRIORITY[item._enriched.state.kind];
    default:
      return '';
  }
}
