# Included third-party assets

- **pdf-lib 1.17.1**: https://github.com/Hopding/pdf-lib / https://www.npmjs.com/package/pdf-lib. MIT; bundled notice: `vendor/pdf-lib.LICENSE.md`.
- **@pdf-lib/fontkit 1.1.1**: https://github.com/Hopding/fontkit / https://www.npmjs.com/package/@pdf-lib/fontkit. Package author Andrew Dillon; fork of Devon Govett's fontkit. The published package declares MIT in its README and does not include a standalone LICENSE file. Its upstream README is retained at `vendor/fontkit.README.md`, including the license link and credits.
- **Nanum Gothic, Nanum Myeongjo, Nanum Gothic Coding**, regular and bold: https://github.com/google/fonts/tree/main/ofl/nanumgothic, https://github.com/google/fonts/tree/main/ofl/nanummyeongjo, https://github.com/google/fonts/tree/main/ofl/nanumgothiccoding. SIL Open Font License 1.1; original notices are in `assets/fonts/*-OFL.txt`. Original TTF files are unmodified. The generated scripts in `assets/font-data/` encode the same font bytes for offline browser loading.

Build font payloads with `node scripts/build-font-data.cjs` after changing original font files. Keep font licenses with distributed assets.
