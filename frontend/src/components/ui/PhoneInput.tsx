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
 * Telefon raqam inputi — to'liq qo'lda kiritish
 * Hech qanday avtomatik formatlash yo'q, foydalanuvchi xohlaganicha yozadi.
 */
export const PhoneInput = ({
  value,
  onChange,
  placeholder = '+998901234567',
  className,
  required,
  disabled,
  autoFocus,
}: PhoneInputProps) => {
  return (
    <input
      type="tel"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={clsx('input', className)}
      required={required}
      disabled={disabled}
      autoFocus={autoFocus}
      inputMode="tel"
    />
  );
};

// Telefon raqamni tekshirish — bo'sh bo'lmasa qabul qilinadi
export const validatePhone = (phone: string): boolean => {
  return phone.trim().length > 0;
};

export default PhoneInput;
