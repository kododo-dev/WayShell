import type { SvgIconComponent } from '@mui/icons-material';
import AppsIcon from '@mui/icons-material/Apps';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import HistoryIcon from '@mui/icons-material/History';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import TimelineIcon from '@mui/icons-material/Timeline';
import TranslateIcon from '@mui/icons-material/Translate';

// The shell bundles only these icons; a Way or link naming another one gets the fallback.
const ICONS: Record<string, SvgIconComponent> = {
  apps: AppsIcon,
  article: ArticleOutlinedIcon,
  logs: ArticleOutlinedIcon,
  dashboard: DashboardOutlinedIcon,
  history: HistoryIcon,
  home: HomeOutlinedIcon,
  key: KeyOutlinedIcon,
  people: PeopleOutlinedIcon,
  users: PeopleOutlinedIcon,
  schedule: ScheduleIcon,
  jobs: ScheduleIcon,
  settings: SettingsOutlinedIcon,
  config: SettingsOutlinedIcon,
  storage: StorageOutlinedIcon,
  timeline: TimelineIcon,
  traces: TimelineIcon,
  translate: TranslateIcon,
  translations: TranslateIcon,
};

/** The icon for a name such as `Settings` or `translate`, or `fallback`. */
export function iconFor(name: string | null | undefined, fallback: SvgIconComponent = AppsIcon): SvgIconComponent {
  return (name && ICONS[name.toLowerCase()]) || fallback;
}

export { ArrowOutwardIcon };
