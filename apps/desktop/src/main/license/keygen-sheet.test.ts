import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

// The key generator's reading of the vehicle sheet (apps/keygen/lib/sheet.cjs).
const sheet = createRequire(import.meta.url)('../../../../keygen/lib/sheet.cjs') as {
  csvExportUrl: (link: string) => string | null;
  parseCsv: (text: string) => string[][];
  vehiclesFromCsv: (text: string) => { serial: string; status: string; customer: string; date: string }[];
  toCsv: (rows: (string | number)[][]) => string;
};

describe('the vehicle sheet', () => {
  it('turns a share link into the CSV export address', () => {
    expect(sheet.csvExportUrl('https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit?usp=drivesdk'))
      .toBe('https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/export?format=csv');
    expect(sheet.csvExportUrl('https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789/edit#gid=42'))
      .toMatch(/export\?format=csv&gid=42$/);
    expect(sheet.csvExportUrl('https://example.com/table')).toBeNull();
  });

  it('reads quoted cells, doubled quotes and line breaks inside a cell', () => {
    expect(sheet.parseCsv('a,"b ""x"", y",c\r\n"two\nlines",,z\n')).toEqual([['a', 'b "x", y', 'c'], ['two\nlines', '', 'z']]);
  });

  it('takes serial, status, customer and date - and nothing else', () => {
    const csv = [
      'Серійний номер,Дата введення в експлуатацію / Передача замовнику,Чи пройшла методику,Статус,Контактний номер телефону замовника,Ім\'я замовника',
      '20990101-0001,24.09.24,НІ,Зданий в експлуатацію,0000000001,',
      '20990101-0002,16.12.24,НІ,Зданий в експлуатацію,0000000002,"Тест ""Замовник"""',
      ',,,,,',
      '20990101-0002,дубль,,,,',
    ].join('\n');
    expect(sheet.vehiclesFromCsv(csv)).toEqual([
      { serial: '20990101-0001', status: 'Зданий в експлуатацію', customer: '', date: '24.09.24' },
      { serial: '20990101-0002', status: 'Зданий в експлуатацію', customer: 'Тест "Замовник"', date: '16.12.24' },
    ]);
    expect(JSON.stringify(sheet.vehiclesFromCsv(csv))).not.toContain('0000000001');
    expect(sheet.vehiclesFromCsv('no,such,columns\n1,2,3')).toEqual([]);
  });

  it('writes a list a spreadsheet opens as it is', () => {
    expect(sheet.toCsv([['№', 'Власник'], ['K0001', 'Тест "Е", рота']])).toBe('﻿№,Власник\r\nK0001,"Тест ""Е"", рота"\r\n');
  });
});
