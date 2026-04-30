'use client';

import dynamic from 'next/dynamic';
import '../i18n';

const ElasticScopeApp = dynamic(() => import('../App'), {
    ssr: false,
});

export const ClientApp = () => <ElasticScopeApp />;
