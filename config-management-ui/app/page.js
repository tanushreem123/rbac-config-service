'use client';
import { useEffect } from 'react';
import { isLoggedIn } from '../lib/auth';

export default function Home() {
  useEffect(() => {
    if (isLoggedIn()) {
      window.location.replace('/configs');
    } else {
      window.location.replace('/login');
    }
  }, []);
  return null;
}
