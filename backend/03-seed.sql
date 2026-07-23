-- ============================================================
--  Cronosfera · Carga inicial de datos (catálogo real)
--  ------------------------------------------------------------
--  Ejecutar DESPUÉS de 01-schema.sql y 02-security.sql
--  Generado automáticamente desde el catálogo actual del sitio.
--  Se puede volver a ejecutar: primero limpia la tabla de productos.
-- ============================================================

truncate table public.products cascade;

insert into public.products
  (category, accessory_type, brand, brand_slug, model, ref, price, was_price, off, wholesale_price,
   tone, tag, stock, stock_status, variants, gender, mechanism, crystal, strap, case_size,
   case_material, water_resistance, description, image)
values
  ('reloj', null, 'CAT', 'cat', 'Multifunción 44mm', '1314926226', 978000, 0, 0, null, 'ink', null, 'Disponible', 'in', '[]'::jsonb, 'Masculino', 'Cuarzo', 'Mineral', 'Silicona', '44mm', 'Acero', '100m', null, 'productos/cat-1314926226.jpg'),
  ('reloj', null, 'Bulova', 'bulova', 'Clásico 38mm', '96B015', 987000, 0, 0, null, 'steel', null, 'Disponible', 'in', '[]'::jsonb, 'Unisex', 'Cuarzo', 'Mineral', 'Acero', '38mm', 'Acero', '50m', null, 'productos/bulova-96b015.jpg'),
  ('reloj', null, 'Casio', 'casio', 'Vintage A100', 'A-100WE-1A', 336000, 0, 0, null, 'ink', null, 'Disponible', 'in', '[]'::jsonb, 'Unisex', 'Digital', 'Plexiglás', 'Acero', '40.7mm', 'Acero', '50m', null, 'productos/casio-a100we1a.jpg'),
  ('reloj', null, 'Casio', 'casio', 'World Time Illuminator', 'AE-1200WHD-1A', 238000, 0, 0, null, 'ink', null, 'Disponible', 'in', '[]'::jsonb, 'Masculino', 'Digital', 'Plexiglás', 'Acero', '42.1mm', 'Resina', '100m', null, 'productos/casio-ae1200whd1a.jpg'),
  ('reloj', null, 'Casio', 'casio', 'Illuminator Anadigi', 'AMW-870DA-2A1', 464000, 0, 0, null, 'ink', null, 'Disponible', 'in', '[]'::jsonb, 'Masculino', 'Anadigi', 'Mineral', 'Acero', '44mm', 'Acero', '100m', null, 'productos/casio-amw870da2a1.jpg'),
  ('reloj', null, 'Citizen', 'citizen', 'Eco-Drive World Time', 'BX1010-02E', 1315000, 0, 0, null, 'cool', null, 'Disponible', 'in', '[]'::jsonb, 'Masculino', 'Cuarzo de recarga solar', 'Mineral', 'Cuero', '44mm', 'Acero', '200m', null, 'productos/citizen-bx101002e.jpg'),
  ('reloj', null, 'Diesel', 'diesel', 'Solar Powered', 'DZ4621', 1343000, 0, 0, null, 'ink', null, 'Disponible', 'in', '[]'::jsonb, 'Masculino', 'Cuarzo', 'Mineral', 'Lona', '49mm', 'Resina', '50m', null, 'productos/diesel-dz4621.jpg'),
  ('reloj', null, 'Fossil', 'fossil', 'Bisel de Cristales', 'ES5130', 959000, 0, 0, null, 'fog', null, 'Disponible', 'in', '[]'::jsonb, 'Femenino', 'Cuarzo', 'Mineral', 'Acero', '37mm', 'Acero', '50m', null, 'productos/fossil-es5130.jpg'),
  ('reloj', null, 'Festina', 'festina', 'Multifunción', 'F16716-4', 522000, 0, 0, null, 'cool', null, 'Disponible', 'in', '[]'::jsonb, 'Femenino', 'Cuarzo', 'Mineral', 'Acero', '36mm', 'Acero', null, null, 'productos/festina-f167164.jpg'),
  ('reloj', null, 'Fossil', 'fossil', 'Cronógrafo Cuero', 'FS5020', 799000, 0, 0, null, 'fog', null, 'Disponible', 'in', '[]'::jsonb, 'Masculino', 'Cuarzo', 'Mineral', 'Cuero', '46mm', 'Acero', '100m', null, 'productos/fossil-fs5020.jpg'),
  ('reloj', null, 'Casio', 'casio', 'G-SHOCK Transparente', 'GA-B001G-2A', 930000, 0, 0, null, 'ink', null, 'Disponible', 'in', '[]'::jsonb, 'Unisex', 'Anadigi', 'Mineral', 'Resina', '46mm', 'Resina', '200m', null, 'productos/casio-gab001g2a.jpg'),
  ('reloj', null, 'Guess', 'guess', 'Diamante', 'GW0528L1', 848000, 0, 0, null, 'fog', null, 'Disponible', 'in', '[]'::jsonb, 'Femenino', 'Cuarzo', 'Mineral', 'Acero', '36mm', 'Acero', '30m', null, 'productos/guess-gw0528l1.jpg'),
  ('reloj', null, 'Mulco', 'mulco', 'Lush Nácar', 'MW317290223', 1330000, 0, 0, null, 'fog', null, 'Disponible', 'in', '[]'::jsonb, 'Femenino', 'Cuarzo', 'Mineral', 'Silicona', '42mm', 'Acero', '100m', null, 'productos/mulco-mw317290223.jpg'),
  ('reloj', null, 'Náutica', 'nautica', 'Bayside Cronógrafo', 'NAPBSS501', 984000, 0, 0, null, 'cool', null, 'Disponible', 'in', '[]'::jsonb, 'Masculino', 'Cuarzo', 'Mineral', 'Silicona', '46mm', 'Acero', '100m', null, 'productos/nautica-napbss501.jpg'),
  ('reloj', null, 'Náutica', 'nautica', 'Cronógrafo + Correa Extra', 'NAPWRS503', 933000, 0, 0, null, 'cool', null, 'Disponible', 'in', '[]'::jsonb, 'Masculino', 'Cuarzo', 'Mineral', 'Silicona', '46mm', 'Acero', '100m', null, 'productos/nautica-napwrs503.jpg'),
  ('reloj', null, 'Orient', 'orient', 'Kamasu', 'RA-AA0004E', 1813000, 0, 0, null, 'green', null, 'Disponible', 'in', '[]'::jsonb, 'Masculino', 'Automático', 'Zafiro', 'Acero', '41.8mm', 'Acero', '200m', null, 'productos/orient-raaa0004e.jpg'),
  ('reloj', null, 'Orient', 'orient', 'Chronograph', 'RA-TX0306S', 1359000, 0, 0, null, 'green', null, 'Disponible', 'in', '[]'::jsonb, 'Masculino', 'Cuarzo de recarga solar', 'Zafiro', 'Cuero', '40mm', 'Acero', '50m', null, 'productos/orient-ratx0306s.jpg'),
  ('reloj', null, 'Swatch', 'swatch', 'Cronógrafo Transparente', 'SB02K100', 952000, 0, 0, null, 'ink', null, 'Disponible', 'in', '[]'::jsonb, 'Unisex', 'Cuarzo', 'Plexiglás', 'Silicona', '47mm', 'Resina', '30m', null, 'productos/swatch-sb02k100.jpg'),
  ('reloj', null, 'Seiko', 'seiko', '5 Sports GMT Negro', 'SSK001K1', 2423000, 0, 0, null, 'ink', null, 'Disponible', 'in', '[]'::jsonb, 'Masculino', 'Automático', 'Hardlex', 'Acero', '42.5mm', 'Acero', '100m', null, 'productos/seiko-ssk001k1.jpg'),
  ('reloj', null, 'Seiko', 'seiko', '5 Sports GMT Azul', 'SSK003K1', 2423000, 0, 0, null, 'ink', null, 'Disponible', 'in', '[]'::jsonb, 'Masculino', 'Automático', 'Hardlex', 'Acero', '42.5mm', 'Acero', '100m', null, 'productos/seiko-ssk003k1.jpg'),
  ('reloj', null, 'Seiko', 'seiko', '5 Sports GMT Naranja', 'SSK005K1', 2423000, 0, 0, null, 'ink', null, 'Disponible', 'in', '[]'::jsonb, 'Masculino', 'Automático', 'Hardlex', 'Acero', '42.5mm', 'Acero', '100m', null, 'productos/seiko-ssk005k1.jpg'),
  ('reloj', null, 'Tissot', 'tissot', 'Seastar Nácar', 'T1202101711600', 3426000, 0, 0, null, 'cool', null, 'Disponible', 'in', '[]'::jsonb, 'Femenino', 'Cuarzo', 'Zafiro', 'Silicona', '36mm', 'Acero', '30m', null, 'productos/tissot-t1202101711600.jpg'),
  ('reloj', null, 'Tissot', 'tissot', 'PRX Verde', 'T1372101108100', 2639000, 0, 0, null, 'cool', null, 'Disponible', 'in', '[]'::jsonb, 'Unisex', 'Cuarzo', 'Zafiro', 'Acero', '35mm', 'Acero', '100m', null, 'productos/tissot-t1372101108100.jpg'),
  ('reloj', null, 'Tissot', 'tissot', 'Cronógrafo Bicolor', 'T1414171701100', 3616000, 0, 0, null, 'cool', null, 'Disponible', 'in', '[]'::jsonb, 'Masculino', 'Cuarzo', 'Zafiro', 'Silicona', '45mm', 'Acero', '100m', null, 'productos/tissot-t1414171701100.jpg'),
  ('reloj', null, 'Tissot', 'tissot', 'T-Race Powermatic 80', 'T1418071104100', 4749000, 0, 0, null, 'cool', null, 'Disponible', 'in', '[]'::jsonb, 'Masculino', 'Automático', 'Zafiro', 'Acero', '45mm', 'Acero', '100m', null, 'productos/tissot-t1418071104100.jpg'),
  ('reloj', null, 'Tissot', 'tissot', 'Bisel Estriado Celeste', 'T1562101135100', 2338000, 0, 0, null, 'cool', null, 'Disponible', 'in', '[]'::jsonb, 'Femenino', 'Cuarzo', 'Zafiro', 'Acero', '36mm', 'Acero', '50m', null, 'productos/tissot-t1562101135100.jpg');

-- Configuración general (sin llaves de pago: esas se ponen en el panel admin)
update public.config
   set data = '{"siteName":"Cronosfera","tagline":"El tiempo también define quién eres.","wholesaleDiscountPct":22,"wholesaleMinQty":6,"auctionDefaults":{"durationHours":24,"minIncrementPct":5,"antiSnipeSeconds":60,"extensionSeconds":120},"hero":{"eyebrow":"Marketplace de relojería · Colombia","title":"El tiempo también<br>define <em>quién eres.</em>","lead":"Descubre relojes originales seleccionados por su diseño, precisión y carácter. Piezas verificadas, envíos a toda Colombia y atención antes y después de la compra.","ctaPrimary":{"label":"Explorar relojes","href":"catalogo.html"},"ctaSecondary":{"label":"Ver subastas en vivo","href":"subastas.html"}}}'::jsonb
 where id = 1;
