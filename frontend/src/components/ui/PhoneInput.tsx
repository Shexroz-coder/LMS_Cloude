import { useRef } from 'react';
import { clsx } from 'clsx';

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}

/**
 * Telefon raqam inputi — +998 prefiksi bilan
 * Foydalanuvchi 9 raqam kiritadi, avtomatik +998 qo'shiladi
 * Saqlash formati: +998XXXXXXXXX
 */
export const PhoneInput = ({
  value,
  onChange,
  placeholder = '+998 XX XXX XX XX',
  className,
  required,
  disabled,
  autoFocus,
}: PhoneInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Kiruvchi qiymatni formatlash: +998901234567 → +998 90 123 45 67
  const formatDisplay = (raw: string): string => {
    // Faqat raqamlarni olish
    const digits = raw.replace(/\D/g, '');
    // 998 prefiksi bilan boshlashini tekshirish
    const local = digits.startsWith('998') ? digits.slice(3) : digits;
    // Maksimal 9 raqam
    const trimmed = local.slice(0, 9);
    // Formatlash: XX XXX XX XX
    if (trimmed.length === 0) return '';
    if (trimmed.length <= 2) return `+998 ${trimmed}`;
    if (trimmed.length <= 5) return `+998 ${trimmed.slice(0, 2)} ${trimmed.slice(2)}`;
    if (trimmed.length <= 7) return `+998 ${trimmed.slice(0, 2)} ${trimmed.slice(2, 5)} ${trimmed.slice(5)}`;
    return `+998 ${trimmed.slice(0, 2)} ${trimmed.slice(2, 5)} ${trimmed.slice(5, 7)} ${trimmed.slice(7)}`;
  };

  // Storage formatiga o'girish: +998901234567
  const toStorageFormat = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('998')) return `+${digits}`;
    if (digits.length === 9) return `+998${digits}`;
    return `+998${digits.slice(-9)}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Kiruvchi matndan raqamlarni olish
    const digits = raw.replace(/\D/g, '');
    const local = digits.startsWith('998') ? digits.slice(3) : digits;
    const trimmed = local.slice(0, 9);

    if (trimmed.length === 0) {
      onChange('');
    } else {
      onChange(toStorageFormat(trimmed));
    }
  };

  return (
    <input
      ref={inputRef}
      type="tel"
      value={value ? formatDisplay(value) : ''}
      onChange={handleChange}
      placeholder={placeholder}
      className={clsx('input', className)}
      required={required}
      disabled={disabled}
      autoFocus={autoFocus}
      inputMode="numeric"
    />
  );
};

// Telefon raqamni tekshirish funksiyasi
export const validatePhone = (phone: string): boolean => {
  return /^\+998\d{9}$/.test(phone.replace(/\s/g, ''));
};

export default PhoneInput;
