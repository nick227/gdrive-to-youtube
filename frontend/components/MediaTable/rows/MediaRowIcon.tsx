import { MimeTypeFilter } from '../data/filters';

interface Props {
  category: MimeTypeFilter | 'other';
}

export default function MediaRowIcon({ category }: Props) {
  if (category === 'other') {
    return <i className="fa-regular fa-question shrink-0 text-xl" />;
  }
  if (category === 'image') {
    return <i className="fa-regular fa-image shrink-0 text-xl" />;
  }
  if (category === 'video') {
    return <i className="fa-solid fa-video shrink-0 text-xl" />;
  }
  return <i className="fa-solid fa-music shrink-0 text-xl" />;
}
