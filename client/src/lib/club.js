// Backward-compatible accessor for the master white-label configuration.
// Everything is sourced from src/config/clubConfig.js — the single file to
// edit when rebranding this template for another organization.
import { CLUB, clubConfig, featureEnabled, subcommitteeEnabled, moduleEnabled } from '../config/clubConfig';

export { CLUB, clubConfig, featureEnabled, subcommitteeEnabled, moduleEnabled };

export const normalizePhone = (v) => String(v || '').replace(/[^\d]/g, '');

export default clubConfig;