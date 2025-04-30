// components/CategoryLabel.tsx
import styles from './CreateReservationPage.module.scss';

interface CategoryLabelProps {
  category: string;
}

const getCategoryClass = (category: string): string => {
  switch (category) {
    case 'Society':
      return styles.society;
    case 'Tênis':
      return styles.tenis;
    case 'Beach Sports':
      return styles.beach;
    case 'Outra':
      return styles.outra;
    default:
      return styles.default;
  }
};

export const CategoryLabel = ({ category }: CategoryLabelProps) => {
  return (
    <p className={`${styles.labelBase} ${getCategoryClass(category)}`}>
      {category}
    </p>
  );
};
