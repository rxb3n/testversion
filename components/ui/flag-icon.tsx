import React from 'react';

interface FlagIconProps {
  country: 'gb' | 'fr' | 'es' | 'de' | 'ru' | 'jp';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const flagUrls = {
  gb: 'https://flagcdn.com/w20/gb.png',
  fr: 'https://flagcdn.com/w20/fr.png',
  es: 'https://flagcdn.com/w20/es.png',
  de: 'https://flagcdn.com/w20/de.png',
  ru: 'https://flagcdn.com/w20/ru.png',
  jp: 'https://flagcdn.com/w20/jp.png',
};

const sizeClasses = {
  sm: 'w-4 h-3 flag-icon small',
  md: 'w-5 h-4 flag-icon medium',
  lg: 'w-6 h-4 flag-icon large',
};

export function FlagIcon({ country, className = '', size = 'md' }: FlagIconProps) {
  return (
    <img
      src={flagUrls[country]}
      alt={`${country.toUpperCase()} flag`}
      className={`inline-block ${sizeClasses[size]} ${className}`}
      style={{ objectFit: 'cover' }}
    />
  );
}

// Helper function to get country code from language value
export function getCountryCode(language: string): 'gb' | 'fr' | 'es' | 'de' | 'ru' | 'jp' {
  const languageToCountry: Record<string, 'gb' | 'fr' | 'es' | 'de' | 'ru' | 'jp'> = {
    english: 'gb',
    french: 'fr',
    spanish: 'es',
    german: 'de',
    russian: 'ru',
    japanese: 'jp',
  };
  return languageToCountry[language] || 'gb';
} 