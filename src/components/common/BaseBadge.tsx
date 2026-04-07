import { Badge } from '@/components/ui/badge';

interface BaseBadgeProps {
  text: string;
  className: string;
}

const BaseBadge = ({ text, className }: BaseBadgeProps) => {
  return (
    <Badge variant='outline' className={`uppercase font-bold ${className}`}>{text}</Badge>
  );
}

export default BaseBadge;