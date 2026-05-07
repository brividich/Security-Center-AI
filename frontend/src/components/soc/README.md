# SOC Components — Security Center AI Design System

Componenti React per l'interfaccia SOC (Security Operations Center) basati sul design handoff.

## Struttura

```
frontend/src/components/soc/
├── Icons.tsx              — Set di icone SOC
├── Layout.tsx             — Frame, Sidebar, Topbar, PageHead
├── Charts.tsx            — Sparkline, Donut, LineChart, Heatmap, GeoMap
├── UI.tsx                — Componenti UI base (Stat, Badge, Button, Avatar, etc.)
├── DashboardComponents.tsx — Componenti specifici per il Dashboard
└── index.ts              — Export principale
```

## Tema CSS

Il tema SOC è definito in `frontend/src/styles/soc-theme.css` e include:

- **Varianti tema**: `light` (Novicrom standard) e `dark` (NOC/Sala controllo)
- **Token di colore**: `--bg`, `--surface`, `--text`, `--accent`, `--critical`, `--high`, `--medium`, `--low`, `--ok`
- **Token di layout**: `--radius`, `--shadow`, `--border`
- **Classi scoped**: Tutte le classi iniziano con `soc-` per evitare conflitti

## Utilizzo

### Import

```tsx
import {
  SOCFrame,
  SOCLayout,
  PageHead,
  Stat,
  Badge,
  Button,
  LineChart,
  Donut,
  Heatmap,
  Icons,
} from "@/components/soc";
```

### Frame e Layout

```tsx
<SOCFrame theme="light" screenLabel="01 Cruscotto KPI">
  <SOCLayout
    active="overview"
    trail={["Operations", "Cruscotto KPI"]}
    status={{ tone: "ok", label: "Pipeline operativa" }}
    onNavigate={(id) => console.log(id)}
  >
    <PageHead
      eyebrow="Operations · Live"
      title="Cruscotto KPI"
      sub="Descrizione della pagina"
      actions={
        <>
          <Button icon={Icons.refresh({ size: 16 })}>Aggiorna</Button>
          <Button variant="primary">Azione principale</Button>
        </>
      }
    />
    {/* Contenuto */}
  </SOCLayout>
</SOCFrame>
```

### Componenti UI

#### Stat (KPI Tile)

```tsx
<Stat
  label="Alert attivi"
  num="248"
  delta="+12.4%"
  trend="up"
  tone="critical"
  data={[180, 190, 195, 210, 205, 225, 238, 248]}
/>
```

#### Badge (Severità)

```tsx
<Badge severity="critical">Critico</Badge>
<Badge severity="high">Alto</Badge>
<Badge severity="medium">Medio</Badge>
<Badge severity="low">Basso</Badge>
<Badge severity="ok">OK</Badge>
```

#### Button

```tsx
<Button>Default</Button>
<Button variant="primary">Primary</Button>
<Button variant="cyan">Cyan</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="danger">Danger</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
```

#### Avatar

```tsx
<Avatar initials="MC" size={20} />
<Avatar initials="AB" size={32} />
<Avatar src="/avatar.jpg" size={40} />
```

### Grafici

#### LineChart

```tsx
<LineChart
  series={[
    { color: "var(--critical)", data: [4,6,3,8,12,9,14,18,22,17,15,12], fill: true },
    { color: "var(--high)", data: [12,15,11,18,22,18,28,32,30,25,22,20], fill: true },
  ]}
  xLabels={["00","02","04","06","08","10","12","14","16","18","20","22"]}
  width={760}
  height={200}
/>
```

#### Donut

```tsx
<Donut
  size={120}
  thickness={14}
  label="248"
  sub="attivi"
  segments={[
    { value: 18, color: "var(--critical)" },
    { value: 64, color: "var(--high)" },
    { value: 102, color: "var(--medium)" },
    { value: 64, color: "var(--low)" },
  ]}
/>
```

#### Heatmap

```tsx
<Heatmap />
```

#### GeoMap

```tsx
<GeoMap
  height={150}
  points={[
    { x: 80, y: 50, r: 12, color: "var(--critical)" },
    { x: 110, y: 80, r: 10, color: "var(--high)" },
  ]}
/>
```

### Componenti Dashboard

#### KpiTile

```tsx
<KpiTile
  label="Alert attivi"
  num="248"
  delta="+12.4%"
  trend="up"
  tone="critical"
  data={[180, 190, 195, 210, 205, 225, 238, 248]}
/>
```

#### PipelineStage

```tsx
<PipelineStage
  label="Receive"
  sub="Mailbox, upload, API"
  n="1.2k/h"
  tone="ok"
/>
<PipelineStage
  label="Normalize"
  sub="schema unificato v3"
  n="1.18k/h"
  tone="ok"
  warn={2}
/>
<PipelineStage
  label="Notify"
  sub="email · webhook · Teams"
  n="0 backlog"
  tone="ok"
  last
/>
```

#### SourceRow

```tsx
<SourceRow
  icon={Icons.shieldChk}
  name="WatchGuard Firebox M470"
  type="syslog"
  n={412}
  data={[12, 18, 14, 22, 28, 30, 26, 34]}
  tone="cyan"
  status="ok"
/>
```

#### AICopilotCard

```tsx
<AICopilotCard
  summary="Cluster anomalo di <b>3 alert critici</b>..."
  suggestions={[
    { icon: Icons.bolt, text: "Isola SRV-MES-04", sev: "crit" },
    { icon: Icons.fileText, text: "Apri evidence container", sev: "med" },
  ]}
/>
```

## Icone

Tutte le icone sono esportate da `Icons`:

```tsx
<Icons.shieldChk size={16} />
<Icons.alert size={20} />
<Icons.bell size={24} />
<Icons.sparkles size={18} />
<Icons.refresh size={16} />
<Icons.settings size={16} />
<Icons.moon size={16} />
<Icons.sun size={16} />
// ... e molte altre
```

## Tema Dark/Light

Il tema è controllato tramite l'attributo `data-soc-theme` sul frame:

```tsx
<SOCFrame theme="dark">
  {/* Contenuto in tema dark */}
</SOCFrame>
```

Per cambiare tema dinamicamente:

```tsx
const [theme, setTheme] = useState<"light" | "dark">("light");

<SOCFrame theme={theme}>
  <Button onClick={() => setTheme(t => t === "light" ? "dark" : "light")}>
    Toggle tema
  </Button>
</SOCFrame>
```

## Token CSS

### Colori

```css
--bg              /* Sfondo principale */
--bg-2            /* Sfondo secondario */
--surface         /* Superficie card */
--surface-2       /* Superficie hover */
--surface-3       /* Superficie accento */
--chrome          /* Sidebar/topbar */
--chrome-text     /* Testo chrome */
--text            /* Testo principale */
--text-mid        /* Testo secondario */
--text-light      /* Testo debole */
--text-faint      /* Testo molto debole */
--accent          /* Colore accento (arancio) */
--cyan            /* Colore cyan */
--critical        /* Severità critica */
--high            /* Severità alta */
--medium          /* Severità media */
--low             /* Severità bassa */
--ok              /* Stato OK */
```

### Layout

```css
--radius-sm       /* 6px */
--radius          /* 10px */
--radius-md       /* 12px */
--radius-lg       /* 16px */
--shadow-sm       /* Ombra piccola */
--shadow          /* Ombra standard */
--shadow-md       /* Ombra media */
```

## Note

- Tutte le classi CSS sono scoped con `soc-` per evitare conflitti con Tailwind
- Il tema utilizza CSS variables per facilitare il cambio tema
- I componenti sono scritti in TypeScript con tipi completi
- Le icone sono SVG inline per evitare dipendenze esterne
