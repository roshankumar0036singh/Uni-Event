import { Platform } from 'react-native';

const mapComponents = Platform.select({
  web: () => require('./MapComponent.web'),
  default: () => require('./MapComponent.native'),
});

const { MapView, Marker, Callout } = mapComponents();

export { MapView, Marker, Callout };
