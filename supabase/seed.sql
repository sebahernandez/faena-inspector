-- GENERATED FILE — do not edit by hand.
-- Run: npm run seed:generate
--
-- Source: src/modules/template/infrastructure/template-seed.ts
-- 5 sections, 51 items.
--
-- Set 'a0000000-0000-4000-8000-00000000000a' before running, e.g.
--   psql -v org_id="'<uuid>'" -f supabase/seed.sql

begin;

insert into templates (id, org_id, name, version, effective_from, published)
values ('00000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-00000000000a',
        'Lista de Chequeo Camión Multiuso', 1, '2026-01-01', true)
on conflict (org_id, name, version) do nothing;

-- 1.- INSPECCIÓN EXTERIOR DEL CAMIÓN (12 ítems)
insert into template_sections (id, template_id, position, code, title)
values ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 1, '1', 'Inspección exterior del camión')
on conflict (template_id, position) do nothing;

insert into template_items (id, section_id, position, code, label) values
  ('00000000-0000-4000-8000-000000010001', '00000000-0000-4000-8000-000000000101', 1, '1.1', 'Neumáticos del. y tras. en buen estado'),
  ('00000000-0000-4000-8000-000000010002', '00000000-0000-4000-8000-000000000101', 2, '1.2', 'Tuercas de ruedas correctamente instaladas'),
  ('00000000-0000-4000-8000-000000010003', '00000000-0000-4000-8000-000000000101', 3, '1.3', 'Luces delanteras y traseras operativas'),
  ('00000000-0000-4000-8000-000000010004', '00000000-0000-4000-8000-000000000101', 4, '1.4', 'Luces de freno y de señalización operativas'),
  ('00000000-0000-4000-8000-000000010005', '00000000-0000-4000-8000-000000000101', 5, '1.5', 'Luces de emergencia operativas'),
  ('00000000-0000-4000-8000-000000010006', '00000000-0000-4000-8000-000000000101', 6, '1.6', 'Espejos retrovisores laterales en buen estado'),
  ('00000000-0000-4000-8000-000000010007', '00000000-0000-4000-8000-000000000101', 7, '1.7', 'Parabrisas y vidrios sin daños'),
  ('00000000-0000-4000-8000-000000010008', '00000000-0000-4000-8000-000000000101', 8, '1.8', 'Limpiaparabrisas operativo'),
  ('00000000-0000-4000-8000-000000010009', '00000000-0000-4000-8000-000000000101', 9, '1.9', 'Bocina / Claxon operativo'),
  ('00000000-0000-4000-8000-000000010010', '00000000-0000-4000-8000-000000000101', 10, '1.10', 'Cinturones de seguridad en buen estado'),
  ('00000000-0000-4000-8000-000000010011', '00000000-0000-4000-8000-000000000101', 11, '1.11', 'Chasis y carrocería sin daños estructurales'),
  ('00000000-0000-4000-8000-000000010012', '00000000-0000-4000-8000-000000000101', 12, '1.12', 'Placa patente delantera y trasera legibles')
on conflict (section_id, position) do nothing;

-- 2.- ESTADO CISTERNA / ESTANQUE (8 ítems)
insert into template_sections (id, template_id, position, code, title)
values ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 2, '2', 'Estado cisterna / estanque')
on conflict (template_id, position) do nothing;

insert into template_items (id, section_id, position, code, label) values
  ('00000000-0000-4000-8000-000000020001', '00000000-0000-4000-8000-000000000102', 1, '2.1', 'Estanque / Cisterna sin daños visibles'),
  ('00000000-0000-4000-8000-000000020002', '00000000-0000-4000-8000-000000000102', 2, '2.2', 'Soldadura y uniones sin grietas visibles'),
  ('00000000-0000-4000-8000-000000020003', '00000000-0000-4000-8000-000000000102', 3, '2.3', 'Tapas y registros correctamente asegurados'),
  ('00000000-0000-4000-8000-000000020004', '00000000-0000-4000-8000-000000000102', 4, '2.4', 'Juntas y empaquetaduras en buen estado'),
  ('00000000-0000-4000-8000-000000020005', '00000000-0000-4000-8000-000000000102', 5, '2.5', 'Válvulas sin fugas'),
  ('00000000-0000-4000-8000-000000020006', '00000000-0000-4000-8000-000000000102', 6, '2.6', 'Mangueras y conexiones aseguradas'),
  ('00000000-0000-4000-8000-000000020007', '00000000-0000-4000-8000-000000000102', 7, '2.7', 'Indicadores de nivel operativos'),
  ('00000000-0000-4000-8000-000000020008', '00000000-0000-4000-8000-000000000102', 8, '2.8', 'Sistema de rebalse / protección en condiciones')
on conflict (section_id, position) do nothing;

-- 3.- SISTEMA DE SUCCIÓN / VACÍO (12 ítems)
insert into template_sections (id, template_id, position, code, title)
values ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 3, '3', 'Sistema de succión / vacío')
on conflict (template_id, position) do nothing;

insert into template_items (id, section_id, position, code, label) values
  ('00000000-0000-4000-8000-000000030001', '00000000-0000-4000-8000-000000000103', 1, '3.1', 'Bomba de vacío en buen estado'),
  ('00000000-0000-4000-8000-000000030002', '00000000-0000-4000-8000-000000000103', 2, '3.2', 'Bomba sin ruidos o vibraciones anormales'),
  ('00000000-0000-4000-8000-000000030003', '00000000-0000-4000-8000-000000000103', 3, '3.3', 'Correas, acoplamientos y protecciones en buen estado'),
  ('00000000-0000-4000-8000-000000030004', '00000000-0000-4000-8000-000000000103', 4, '3.4', 'Mangueras de succión en buen estado'),
  ('00000000-0000-4000-8000-000000030005', '00000000-0000-4000-8000-000000000103', 5, '3.5', 'Acoples y conexiones de succión en buen estado'),
  ('00000000-0000-4000-8000-000000030006', '00000000-0000-4000-8000-000000000103', 6, '3.6', 'Abrazaderas y elementos de fijación instalados'),
  ('00000000-0000-4000-8000-000000030007', '00000000-0000-4000-8000-000000000103', 7, '3.7', 'Válvulas de succión operativas'),
  ('00000000-0000-4000-8000-000000030008', '00000000-0000-4000-8000-000000000103', 8, '3.8', 'Filtro / protección de bomba operativa'),
  ('00000000-0000-4000-8000-000000030009', '00000000-0000-4000-8000-000000000103', 9, '3.9', 'Indicador / manómetro de vacío operativo'),
  ('00000000-0000-4000-8000-000000030010', '00000000-0000-4000-8000-000000000103', 10, '3.10', 'Sistema de corte / protección sobrellenado operativo'),
  ('00000000-0000-4000-8000-000000030011', '00000000-0000-4000-8000-000000000103', 11, '3.11', 'Sistema de descarga operativo'),
  ('00000000-0000-4000-8000-000000030012', '00000000-0000-4000-8000-000000000103', 12, '3.12', 'No existen fugas en el circuito de vacío')
on conflict (section_id, position) do nothing;

-- 4.- SISTEMA DE HIDROJET / ALTA PRESIÓN (13 ítems)
insert into template_sections (id, template_id, position, code, title)
values ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001', 4, '4', 'Sistema de hidrojet / alta presión')
on conflict (template_id, position) do nothing;

insert into template_items (id, section_id, position, code, label) values
  ('00000000-0000-4000-8000-000000040001', '00000000-0000-4000-8000-000000000104', 1, '4.1', 'Bomba de alta presión en buen estado'),
  ('00000000-0000-4000-8000-000000040002', '00000000-0000-4000-8000-000000000104', 2, '4.2', 'Nivel de aceite de la bomba adecuado'),
  ('00000000-0000-4000-8000-000000040003', '00000000-0000-4000-8000-000000000104', 3, '4.3', 'Manguera de alta presión sin daños, operativa'),
  ('00000000-0000-4000-8000-000000040004', '00000000-0000-4000-8000-000000000104', 4, '4.4', 'Manguera correctamente almacenada'),
  ('00000000-0000-4000-8000-000000040005', '00000000-0000-4000-8000-000000000104', 5, '4.5', 'Conexiones y acoples de alta presión en buen estado'),
  ('00000000-0000-4000-8000-000000040006', '00000000-0000-4000-8000-000000000104', 6, '4.6', 'Pistola de alta presión en buen estado'),
  ('00000000-0000-4000-8000-000000040007', '00000000-0000-4000-8000-000000000104', 7, '4.7', 'Dispositivo de accionamiento en buen estado'),
  ('00000000-0000-4000-8000-000000040008', '00000000-0000-4000-8000-000000000104', 8, '4.8', 'Boquillas adecuadas para trabajo en buen estado'),
  ('00000000-0000-4000-8000-000000040009', '00000000-0000-4000-8000-000000000104', 9, '4.9', 'Manómetro de presión operativo'),
  ('00000000-0000-4000-8000-000000040010', '00000000-0000-4000-8000-000000000104', 10, '4.10', 'Válvula de alivio / seguridad operativa'),
  ('00000000-0000-4000-8000-000000040011', '00000000-0000-4000-8000-000000000104', 11, '4.11', 'Válvulas de control operativas'),
  ('00000000-0000-4000-8000-000000040012', '00000000-0000-4000-8000-000000000104', 12, '4.12', 'Sistema de descarga / recirculación operativo'),
  ('00000000-0000-4000-8000-000000040013', '00000000-0000-4000-8000-000000000104', 13, '4.13', 'No existen fugas de agua a alta presión')
on conflict (section_id, position) do nothing;

-- 5.- SISTEMAS DE SEGURIDAD (6 ítems)
insert into template_sections (id, template_id, position, code, title)
values ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001', 5, '5', 'Sistemas de seguridad')
on conflict (template_id, position) do nothing;

insert into template_items (id, section_id, position, code, label) values
  ('00000000-0000-4000-8000-000000050001', '00000000-0000-4000-8000-000000000105', 1, '5.1', 'Extintor disponible, vigente e instalado'),
  ('00000000-0000-4000-8000-000000050002', '00000000-0000-4000-8000-000000000105', 2, '5.2', 'Botiquín disponible y equipado'),
  ('00000000-0000-4000-8000-000000050003', '00000000-0000-4000-8000-000000000105', 3, '5.3', 'Cuñas para ruedas disponibles'),
  ('00000000-0000-4000-8000-000000050004', '00000000-0000-4000-8000-000000000105', 4, '5.4', 'Conos de seguridad disponibles'),
  ('00000000-0000-4000-8000-000000050005', '00000000-0000-4000-8000-000000000105', 5, '5.5', 'Baliza / luz de emergencia operativa'),
  ('00000000-0000-4000-8000-000000050006', '00000000-0000-4000-8000-000000000105', 6, '5.6', 'Alarma de retroceso operativa')
on conflict (section_id, position) do nothing;

commit;
