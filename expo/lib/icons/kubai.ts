// Deep imports keep Metro from bundling all ~3000 Kubai icons.
import BookData from 'kubai-icons/icons/book';
import GlobeData from 'kubai-icons/icons/globe';
import LanguagesData from 'kubai-icons/icons/languages';
import LogOutData from 'kubai-icons/icons/log-out';
import MapData from 'kubai-icons/icons/map';
import PackageData from 'kubai-icons/icons/package';
import PencilData from 'kubai-icons/icons/pencil';
import PencilRulerData from 'kubai-icons/icons/pencil-ruler';
import SatelliteData from 'kubai-icons/icons/satellite';
import TentData from 'kubai-icons/icons/tent';
import TrashData from 'kubai-icons/icons/trash';
import UserRoundData from 'kubai-icons/icons/user-round';
import UsersRoundData from 'kubai-icons/icons/users-round';

import { createKubaiIcon } from '~/components/ui/kubai-icon';

export const KubaiBookIcon = createKubaiIcon(BookData);
export const KubaiGlobeIcon = createKubaiIcon(GlobeData);
export const KubaiLanguagesIcon = createKubaiIcon(LanguagesData);
export const KubaiLogOutIcon = createKubaiIcon(LogOutData);
export const KubaiMapIcon = createKubaiIcon(MapData);
export const KubaiPackageIcon = createKubaiIcon(PackageData);
export const KubaiPencilIcon = createKubaiIcon(PencilData);
export const KubaiPencilRulerIcon = createKubaiIcon(PencilRulerData);
export const KubaiSatelliteIcon = createKubaiIcon(SatelliteData);
export const KubaiTentIcon = createKubaiIcon(TentData);
export const KubaiTrashIcon = createKubaiIcon(TrashData);
export const KubaiUserRoundIcon = createKubaiIcon(UserRoundData);
export const KubaiUsersRoundIcon = createKubaiIcon(UsersRoundData);
