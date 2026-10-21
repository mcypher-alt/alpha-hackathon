'use client';

import React from 'react';
import { ConfigProvider, theme } from 'antd';
import { StyleProvider } from '@ant-design/cssinjs';
import ruRU from 'antd/locale/ru_RU';

export function AntdAlfaProvider({ children }: { children: React.ReactNode }) {
  return (
    <StyleProvider hashPriority="high">
      <ConfigProvider
        locale={ruRU}
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: '#EF3124',
            colorInfo: '#EF3124',
            colorSuccess: '#0CC44D',
            colorWarning: '#FF7024',
            colorError: '#F93232',
            colorTextBase: '#0B1F35',
            colorBgBase: '#FFFFFF',
            borderRadius: 10,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          },
          components: {
            Button: {
              colorPrimary: '#EF3124',
              colorPrimaryHover: '#D82317',
              colorPrimaryActive: '#B81B11',
              borderRadius: 8,
              controlHeight: 40,
            },
            Table: {
              headerBg: '#F3F4F7',
              headerColor: '#0B1F35',
              rowHoverBg: '#FAFAFB',
              borderRadius: 12,
            },
            Card: {
              borderRadiusLG: 12,
            },
            Steps: {
              colorPrimary: '#EF3124',
            },
          },
        }}
      >
        {children}
      </ConfigProvider>
    </StyleProvider>
  );
}