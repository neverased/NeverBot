# Changelog

## [3.9.0](https://github.com/neverased/NeverBot/compare/never-bot-v3.8.0...never-bot-v3.9.0) (2025-08-13)


### Features

* add cron-based wiki reindexing support ([58fb311](https://github.com/neverased/NeverBot/commit/58fb31192acc21a4b23b7c1571fbcc807ce424be))

## [3.8.0](https://github.com/neverased/NeverBot/compare/never-bot-v3.7.0...never-bot-v3.8.0) (2025-08-13)


### Features

* add env toggle for RAG citations ([fedf064](https://github.com/neverased/NeverBot/commit/fedf064eeaf8a3224174ce85ccce30db7cc681fc))

## [3.7.0](https://github.com/neverased/NeverBot/compare/never-bot-v3.6.0...never-bot-v3.7.0) (2025-08-13)


### Features

* keep witty persona with sources ([13fc4c2](https://github.com/neverased/NeverBot/commit/13fc4c2d0858460a06cea99f063b02f963400c44))

## [3.6.0](https://github.com/neverased/NeverBot/compare/never-bot-v3.5.0...never-bot-v3.6.0) (2025-08-13)


### Features

* add SoS wiki RAG grounding ([3db11d8](https://github.com/neverased/NeverBot/commit/3db11d8fa2ce95e60fc20533d860187db7407832))
* add welcome/trap features & env validation ([351be39](https://github.com/neverased/NeverBot/commit/351be39677acc3237832350ebf46509afcf8579f))

## [3.5.0](https://github.com/neverased/NeverBot/compare/never-bot-v3.4.0...never-bot-v3.5.0) (2025-07-06)

### Features

* upgrade to OpenAI o3 model with max_completion_tokens parameter ([f6f1cf2](https://github.com/neverased/NeverBot/commit/f6f1cf216328d7c1ec95feb6fb032dfe5cf3ab5c))

## [3.4.0](https://github.com/neverased/NeverBot/compare/never-bot-v3.3.0...never-bot-v3.4.0) (2025-06-15)

### Features

* migrate server config to dedicated servers collection ([b71acc4](https://github.com/neverased/NeverBot/commit/b71acc4c1f5d993ebe452213fd97acefa7e91cbe))

## [3.3.0](https://github.com/neverased/NeverBot/compare/never-bot-v3.2.0...never-bot-v3.3.0) (2025-06-15)

### Features

* add per-channel bot enablement controls ([cdce130](https://github.com/neverased/NeverBot/commit/cdce130381e3ab0331292aff6f1395306d668b3d))
* add slash command for AI-powered changelog summaries ([8eca3f7](https://github.com/neverased/NeverBot/commit/8eca3f7df8745e8bf622735f52ec515ecc004ade))

## [3.2.0](https://github.com/neverased/NeverBot/compare/never-bot-v3.1.0...never-bot-v3.2.0) (2025-05-22)

### Features

* enhance convo handling and persona context ([0f366d4](https://github.com/neverased/NeverBot/commit/0f366d4c32d29d16d677d8ff0c6f91c40bb292e8))
* enriches chatbot persona with dynamic emotions ([9be7f60](https://github.com/neverased/NeverBot/commit/9be7f60b19f23e9e56c5bd5c74ebed3bac74bce1))

## [3.1.0](https://github.com/neverased/NeverBot/compare/never-bot-v3.0.0...never-bot-v3.1.0) (2025-05-22)

### Features

* add scripts for backfilling and force-updating summaries ([4365516](https://github.com/neverased/NeverBot/commit/4365516a1e5b2c54dfd7cfbb7606857497dab054))

## [3.0.0](https://github.com/neverased/NeverBot/compare/never-bot-v2.14.0...never-bot-v3.0.0) (2025-05-21)

### ⚠ BREAKING CHANGES

* Removed GPT imagine_v3 command

### Features

* add Docker support ([004c2e8](https://github.com/neverased/NeverBot/commit/004c2e84eb62f7dd6018f711d23636656da8d6e3))
* Add eslint-formatter-sarif and new SARIF file ([bb001f8](https://github.com/neverased/NeverBot/commit/bb001f80b4b4a4e4173d02a53f39aab6b47e416a))
* Add GitHub Actions deployment workflow ([73d52a2](https://github.com/neverased/NeverBot/commit/73d52a241c00d2f831f0639559777c8765f6a582))
* Add new SARIF results file ([ef2a982](https://github.com/neverased/NeverBot/commit/ef2a9824a11a103f80295c8b26e4cef99562a1e8))
* add personality insights and improve conversation context ([b1d8c68](https://github.com/neverased/NeverBot/commit/b1d8c684717b77ca2ce1025b71128b1c5136b248))
* enhance Discord service with better error handling and logging ([c171279](https://github.com/neverased/NeverBot/commit/c1712790e7ea046635d1a9c7dca5c1c2bf9a8e59))
* Enhance GitHub workflows and Discord bot commands ([d7eac4e](https://github.com/neverased/NeverBot/commit/d7eac4e854828bc0f71506e3a328d2abe833f91b))
* ESLint and codebase improvements ([0d2df37](https://github.com/neverased/NeverBot/commit/0d2df376c5e7de99857b6baecbe74e8a1350cb08))
* Image Generation DALL-E v3 ([7d3afb1](https://github.com/neverased/NeverBot/commit/7d3afb175e2dd628c93749cd5006ad475b4a463d))
* Improve build workflow ([db341a1](https://github.com/neverased/NeverBot/commit/db341a1967bf965d96ce5b0cf74d793ee58c937e))
* Refactor ESLint configuration and update dependencies ([da8843b](https://github.com/neverased/NeverBot/commit/da8843bcf5e6b37d3e1333a593726a7714c04bdc))
* Remove CodeQL workflow ([9587a92](https://github.com/neverased/NeverBot/commit/9587a92556f380dc93bf4bc041c230dd07755487))
* Remove sarif_file from eslint workflow ([f34b910](https://github.com/neverased/NeverBot/commit/f34b91055c2e2b9005360993a9d814116e9260a5))
* streamline deployment workflow ([04c10e0](https://github.com/neverased/NeverBot/commit/04c10e0e0b973a6f6af57224a640b2745f632a05))
* streamline eslint workflow ([50e6c99](https://github.com/neverased/NeverBot/commit/50e6c9900d9f62cdc020e03875ec549bc6783870))
* Switch to pnpm and update dependencies ([ae06ab1](https://github.com/neverased/NeverBot/commit/ae06ab1defd53d78f2e821b925b7d8518b538c36))
* Update .gitignore and remove results.sarif ([6ea2134](https://github.com/neverased/NeverBot/commit/6ea21345a35c1c6ddce94245ff9fdf7ce35e6fe4))
* Update Codacy workflow, gitignore, and package dependencies ([a1d10ab](https://github.com/neverased/NeverBot/commit/a1d10aba6316ae7d12e6c660c14049bd8cae218a))
* update codeql-action version ([2963649](https://github.com/neverased/NeverBot/commit/2963649962d225c603a2737fdc3f98dc1d42c0a0))
* update dependencies and enhance chatbot functionality ([f9bfdd2](https://github.com/neverased/NeverBot/commit/f9bfdd29304951311c1b5517532a3a024b2864f2))
* Update dependencies and improve chatbot response handling ([032cfd9](https://github.com/neverased/NeverBot/commit/032cfd92077581d4a6cc87092d232127548bdf9c))
* update dependencies and improve code formatting ([444733b](https://github.com/neverased/NeverBot/commit/444733b0131942460b82c77d37589294359bbb48))
* Update dependencies and remove unused image ([172a1fb](https://github.com/neverased/NeverBot/commit/172a1fb01755ccc31a6af17f37984c385e0d7152))
* Update dependencies in package.json ([9855058](https://github.com/neverased/NeverBot/commit/9855058eb7b5bb66f05715c0f4147cf9b31c7caa))
* Update dependencies in package.json ([eaf3820](https://github.com/neverased/NeverBot/commit/eaf3820c593de7c20b0a4a030bcb07a60b86ec73))
* Update dependencies in package.json ([b4c8da4](https://github.com/neverased/NeverBot/commit/b4c8da4aba15f1aea821b5c065013933c25ff74e))
* Update dependencies in package.json ([097cd18](https://github.com/neverased/NeverBot/commit/097cd18b1684e39b7ea3dbeb397a53a45ee13ee2))
* Update dependencies in package.json ([d734c40](https://github.com/neverased/NeverBot/commit/d734c4039010305ed74b84a4c53254f1ed50cf3a))
* Update dependencies in package.json ([a3da0cc](https://github.com/neverased/NeverBot/commit/a3da0ccc86cee09aeaa6629de9af51e7fdfd6706))
* Update ESLint command and add SARIF results ([a538bf8](https://github.com/neverased/NeverBot/commit/a538bf89f36978cf2d1ad6d2dd18a7ec01fec18a))
* Update GitHub workflow for build checks ([83edb5a](https://github.com/neverased/NeverBot/commit/83edb5a5ab9cc6a095c2883cc0a57f990a1c9eed))
* update Node.js and ESLint versions ([79de15e](https://github.com/neverased/NeverBot/commit/79de15eeb2bf163f0c6f515efe4f7c8784bd8656))
* update package dependencies ([a003062](https://github.com/neverased/NeverBot/commit/a003062cd5540164584716a9486697e5b3b9d37c))
* update package dependencies ([63a76c6](https://github.com/neverased/NeverBot/commit/63a76c64cb5208a87858a3f50815b4641bbbdaf4))
* update package dependencies ([6d838aa](https://github.com/neverased/NeverBot/commit/6d838aac82723a2f1217dd99485e8300e0048ad1))
* update package dependencies ([a9453f5](https://github.com/neverased/NeverBot/commit/a9453f5be2601df05e4efb217b2fc7b37f966e82))
* update package dependencies ([98de5a4](https://github.com/neverased/NeverBot/commit/98de5a44f2123dfa8413a1471e27911cbcdf42b9))
* update package dependencies ([55f87ab](https://github.com/neverased/NeverBot/commit/55f87aba92365471c10919285bb2a3c09a92ff5e))
* update package dependencies ([e2b5788](https://github.com/neverased/NeverBot/commit/e2b5788d6365c82eca5ff0012e535a651a54690d))
* update package dependencies ([eab17f4](https://github.com/neverased/NeverBot/commit/eab17f476e9715dc2fd4a93ae5740d6d9ca782c6))
* Update package dependencies ([0bd8833](https://github.com/neverased/NeverBot/commit/0bd8833c18b31ecc727d7631fcf03cc38f308524))
* Update package dependencies ([20f7b49](https://github.com/neverased/NeverBot/commit/20f7b4924b16d9d47c60ca9d429dafe29120771a))
* Update package dependencies ([9d62404](https://github.com/neverased/NeverBot/commit/9d624043d7bfd1ecbafad77e64579850754c6239))
* Update package dependencies ([37b7b7a](https://github.com/neverased/NeverBot/commit/37b7b7ad5730923d0821071d1e270214fc7d70a3))
* Update package dependencies and chatbot response ([554cf2c](https://github.com/neverased/NeverBot/commit/554cf2ce67642e7dd1388755b37c99b08d2cc268))
* Update package dependencies and GPT model ([ad4d1ac](https://github.com/neverased/NeverBot/commit/ad4d1ac7075315974ad084c700ca99b1a6fcc820))
* Update package dependencies and GPT model ([f145e2b](https://github.com/neverased/NeverBot/commit/f145e2b545b825fe3191737aaa0f84b8aa8dbd9f))
* Update pnpm setup in GitHub workflow ([9e36298](https://github.com/neverased/NeverBot/commit/9e36298238f5b27eb26d23b70d55dac3cc944b9f))
* upgrade typescript-eslint version ([60e7484](https://github.com/neverased/NeverBot/commit/60e74849df7e9add3d8c642319a74257b4564d96))

### Bug Fixes

* **botstat:** correct memory units and formatting ([7215108](https://github.com/neverased/NeverBot/commit/7215108e44d9c42050e05634d104d3287f387551))
* Fix eslint and typescript-eslint versions ([9d62404](https://github.com/neverased/NeverBot/commit/9d624043d7bfd1ecbafad77e64579850754c6239))
* Fix typo in GPT ask command ([37b7b7a](https://github.com/neverased/NeverBot/commit/37b7b7ad5730923d0821071d1e270214fc7d70a3))
* Update chatbot response in ask.ts ([d734c40](https://github.com/neverased/NeverBot/commit/d734c4039010305ed74b84a4c53254f1ed50cf3a))

### Code Refactoring

* Refactor GPT imagine command ([37b7b7a](https://github.com/neverased/NeverBot/commit/37b7b7ad5730923d0821071d1e270214fc7d70a3)), closes [#123](https://github.com/neverased/NeverBot/issues/123)

## [2.14.0](https://github.com/neverased/NeverBot/compare/never-bot-v2.13.0...never-bot-v2.14.0) (2025-05-20)

### Features

* add personality insights and improve conversation context ([b1d8c68](https://github.com/neverased/NeverBot/commit/b1d8c684717b77ca2ce1025b71128b1c5136b248))

## [2.13.0](https://github.com/neverased/NeverBot/compare/never-bot-v2.12.0...never-bot-v2.13.0) (2025-01-02)

### Features

* add Docker support ([004c2e8](https://github.com/neverased/NeverBot/commit/004c2e84eb62f7dd6018f711d23636656da8d6e3))

### Bug Fixes

* **botstat:** correct memory units and formatting ([7215108](https://github.com/neverased/NeverBot/commit/7215108e44d9c42050e05634d104d3287f387551))

## [2.12.0](https://github.com/neverased/NeverBot/compare/never-bot-v2.11.0...never-bot-v2.12.0) (2024-10-17)

### Features

* update package dependencies ([a003062](https://github.com/neverased/NeverBot/commit/a003062cd5540164584716a9486697e5b3b9d37c))
* Update package dependencies and GPT model ([ad4d1ac](https://github.com/neverased/NeverBot/commit/ad4d1ac7075315974ad084c700ca99b1a6fcc820))

## [2.11.0](https://github.com/neverased/NeverBot/compare/never-bot-v2.10.0...never-bot-v2.11.0) (2024-08-05)

### Features

* update package dependencies ([63a76c6](https://github.com/neverased/NeverBot/commit/63a76c64cb5208a87858a3f50815b4641bbbdaf4))

## [2.10.0](https://github.com/neverased/NeverBot/compare/never-bot-v2.9.0...never-bot-v2.10.0) (2024-07-19)

### Features

* Improve build workflow ([db341a1](https://github.com/neverased/NeverBot/commit/db341a1967bf965d96ce5b0cf74d793ee58c937e))
* Switch to pnpm and update dependencies ([ae06ab1](https://github.com/neverased/NeverBot/commit/ae06ab1defd53d78f2e821b925b7d8518b538c36))
* Update package dependencies ([0bd8833](https://github.com/neverased/NeverBot/commit/0bd8833c18b31ecc727d7631fcf03cc38f308524))
* Update pnpm setup in GitHub workflow ([9e36298](https://github.com/neverased/NeverBot/commit/9e36298238f5b27eb26d23b70d55dac3cc944b9f))

## [2.9.0](https://github.com/neverased/NeverBot/compare/never-bot-v2.8.0...never-bot-v2.9.0) (2024-07-02)

### Features

* ESLint and codebase improvements ([0d2df37](https://github.com/neverased/NeverBot/commit/0d2df376c5e7de99857b6baecbe74e8a1350cb08))
* Update .gitignore and remove results.sarif ([6ea2134](https://github.com/neverased/NeverBot/commit/6ea21345a35c1c6ddce94245ff9fdf7ce35e6fe4))

## [2.8.0](https://github.com/neverased/NeverBot/compare/never-bot-v2.7.0...never-bot-v2.8.0) (2024-07-02)

### Features

* Add eslint-formatter-sarif and new SARIF file ([bb001f8](https://github.com/neverased/NeverBot/commit/bb001f80b4b4a4e4173d02a53f39aab6b47e416a))
* Add new SARIF results file ([ef2a982](https://github.com/neverased/NeverBot/commit/ef2a9824a11a103f80295c8b26e4cef99562a1e8))
* enhance Discord service with better error handling and logging ([c171279](https://github.com/neverased/NeverBot/commit/c1712790e7ea046635d1a9c7dca5c1c2bf9a8e59))
* Remove CodeQL workflow ([9587a92](https://github.com/neverased/NeverBot/commit/9587a92556f380dc93bf4bc041c230dd07755487))
* update dependencies and improve code formatting ([444733b](https://github.com/neverased/NeverBot/commit/444733b0131942460b82c77d37589294359bbb48))
* Update ESLint command and add SARIF results ([a538bf8](https://github.com/neverased/NeverBot/commit/a538bf89f36978cf2d1ad6d2dd18a7ec01fec18a))
* update package dependencies ([6d838aa](https://github.com/neverased/NeverBot/commit/6d838aac82723a2f1217dd99485e8300e0048ad1))
* Update package dependencies ([20f7b49](https://github.com/neverased/NeverBot/commit/20f7b4924b16d9d47c60ca9d429dafe29120771a))

## [2.7.0](https://github.com/neverased/NeverBot/compare/never-bot-v2.6.0...never-bot-v2.7.0) (2024-05-27)

### Features

* Refactor ESLint configuration and update dependencies ([da8843b](https://github.com/neverased/NeverBot/commit/da8843bcf5e6b37d3e1333a593726a7714c04bdc))
* Remove sarif_file from eslint workflow ([f34b910](https://github.com/neverased/NeverBot/commit/f34b91055c2e2b9005360993a9d814116e9260a5))
* streamline eslint workflow ([50e6c99](https://github.com/neverased/NeverBot/commit/50e6c9900d9f62cdc020e03875ec549bc6783870))
* update codeql-action version ([2963649](https://github.com/neverased/NeverBot/commit/2963649962d225c603a2737fdc3f98dc1d42c0a0))
* update Node.js and ESLint versions ([79de15e](https://github.com/neverased/NeverBot/commit/79de15eeb2bf163f0c6f515efe4f7c8784bd8656))
* update package dependencies ([a9453f5](https://github.com/neverased/NeverBot/commit/a9453f5be2601df05e4efb217b2fc7b37f966e82))
* update package dependencies ([98de5a4](https://github.com/neverased/NeverBot/commit/98de5a44f2123dfa8413a1471e27911cbcdf42b9))
* upgrade typescript-eslint version ([60e7484](https://github.com/neverased/NeverBot/commit/60e74849df7e9add3d8c642319a74257b4564d96))

## [2.6.0](https://github.com/neverased/NeverBot/compare/never-bot-v2.5.0...never-bot-v2.6.0) (2024-05-13)

### Features

* Update dependencies and improve chatbot response handling ([032cfd9](https://github.com/neverased/NeverBot/commit/032cfd92077581d4a6cc87092d232127548bdf9c))

## [2.5.0](https://github.com/neverased/NeverBot/compare/never-bot-v2.4.0...never-bot-v2.5.0) (2024-05-05)

### Features

* update package dependencies ([55f87ab](https://github.com/neverased/NeverBot/commit/55f87aba92365471c10919285bb2a3c09a92ff5e))

## [2.4.0](https://github.com/neverased/NeverBot/compare/never-bot-v2.3.0...never-bot-v2.4.0) (2024-04-25)

### Features

* Update package dependencies and GPT model ([f145e2b](https://github.com/neverased/NeverBot/commit/f145e2b545b825fe3191737aaa0f84b8aa8dbd9f))

## [2.3.0](https://github.com/neverased/NeverBot/compare/never-bot-v2.2.0...never-bot-v2.3.0) (2024-04-23)

### Features

* update package dependencies ([e2b5788](https://github.com/neverased/NeverBot/commit/e2b5788d6365c82eca5ff0012e535a651a54690d))

## [2.2.0](https://github.com/neverased/NeverBot/compare/never-bot-v2.1.0...never-bot-v2.2.0) (2024-04-10)

### Features

* Update GitHub workflow for build checks ([83edb5a](https://github.com/neverased/NeverBot/commit/83edb5a5ab9cc6a095c2883cc0a57f990a1c9eed))

## [2.1.0](https://github.com/neverased/NeverBot/compare/never-bot-v2.0.0...never-bot-v2.1.0) (2024-04-10)

### Features

* streamline deployment workflow ([04c10e0](https://github.com/neverased/NeverBot/commit/04c10e0e0b973a6f6af57224a640b2745f632a05))

## [2.0.0](https://github.com/neverased/NeverBot/compare/never-bot-v1.1.0...never-bot-v2.0.0) (2024-04-10)

### ⚠ BREAKING CHANGES

* Removed GPT imagine_v3 command

### Features

* Add GitHub Actions deployment workflow ([73d52a2](https://github.com/neverased/NeverBot/commit/73d52a241c00d2f831f0639559777c8765f6a582))
* Enhance GitHub workflows and Discord bot commands ([d7eac4e](https://github.com/neverased/NeverBot/commit/d7eac4e854828bc0f71506e3a328d2abe833f91b))
* Image Generation DALL-E v3 ([7d3afb1](https://github.com/neverased/NeverBot/commit/7d3afb175e2dd628c93749cd5006ad475b4a463d))
* Update Codacy workflow, gitignore, and package dependencies ([a1d10ab](https://github.com/neverased/NeverBot/commit/a1d10aba6316ae7d12e6c660c14049bd8cae218a))
* update dependencies and enhance chatbot functionality ([f9bfdd2](https://github.com/neverased/NeverBot/commit/f9bfdd29304951311c1b5517532a3a024b2864f2))
* Update dependencies and remove unused image ([172a1fb](https://github.com/neverased/NeverBot/commit/172a1fb01755ccc31a6af17f37984c385e0d7152))
* Update dependencies in package.json ([9855058](https://github.com/neverased/NeverBot/commit/9855058eb7b5bb66f05715c0f4147cf9b31c7caa))
* Update dependencies in package.json ([eaf3820](https://github.com/neverased/NeverBot/commit/eaf3820c593de7c20b0a4a030bcb07a60b86ec73))
* Update dependencies in package.json ([b4c8da4](https://github.com/neverased/NeverBot/commit/b4c8da4aba15f1aea821b5c065013933c25ff74e))
* Update dependencies in package.json ([097cd18](https://github.com/neverased/NeverBot/commit/097cd18b1684e39b7ea3dbeb397a53a45ee13ee2))
* Update dependencies in package.json ([d734c40](https://github.com/neverased/NeverBot/commit/d734c4039010305ed74b84a4c53254f1ed50cf3a))
* Update dependencies in package.json ([a3da0cc](https://github.com/neverased/NeverBot/commit/a3da0ccc86cee09aeaa6629de9af51e7fdfd6706))
* update package dependencies ([eab17f4](https://github.com/neverased/NeverBot/commit/eab17f476e9715dc2fd4a93ae5740d6d9ca782c6))
* Update package dependencies ([9d62404](https://github.com/neverased/NeverBot/commit/9d624043d7bfd1ecbafad77e64579850754c6239))
* Update package dependencies ([37b7b7a](https://github.com/neverased/NeverBot/commit/37b7b7ad5730923d0821071d1e270214fc7d70a3)), closes [#123](https://github.com/neverased/NeverBot/issues/123)
* Update package dependencies and chatbot response ([554cf2c](https://github.com/neverased/NeverBot/commit/554cf2ce67642e7dd1388755b37c99b08d2cc268))

## [1.1.0](https://github.com/neverased/NeverBot/compare/v1.0.0...v1.1.0) (2024-04-10)

### Features

* update package dependencies ([eab17f4](https://github.com/neverased/NeverBot/commit/eab17f476e9715dc2fd4a93ae5740d6d9ca782c6))

## 1.0.0 (2024-03-06)

### ⚠ BREAKING CHANGES

* Removed GPT imagine_v3 command

### Features

* Image Generation DALL-E v3 ([7d3afb1](https://github.com/neverased/NeverBot/commit/7d3afb175e2dd628c93749cd5006ad475b4a463d))
* Update Codacy workflow, gitignore, and package dependencies ([a1d10ab](https://github.com/neverased/NeverBot/commit/a1d10aba6316ae7d12e6c660c14049bd8cae218a))
* update dependencies and enhance chatbot functionality ([f9bfdd2](https://github.com/neverased/NeverBot/commit/f9bfdd29304951311c1b5517532a3a024b2864f2))
* Update dependencies and remove unused image ([172a1fb](https://github.com/neverased/NeverBot/commit/172a1fb01755ccc31a6af17f37984c385e0d7152))
* Update dependencies in package.json ([9855058](https://github.com/neverased/NeverBot/commit/9855058eb7b5bb66f05715c0f4147cf9b31c7caa))
* Update dependencies in package.json ([eaf3820](https://github.com/neverased/NeverBot/commit/eaf3820c593de7c20b0a4a030bcb07a60b86ec73))
* Update dependencies in package.json ([b4c8da4](https://github.com/neverased/NeverBot/commit/b4c8da4aba15f1aea821b5c065013933c25ff74e))
* Update dependencies in package.json ([097cd18](https://github.com/neverased/NeverBot/commit/097cd18b1684e39b7ea3dbeb397a53a45ee13ee2))
* Update dependencies in package.json ([d734c40](https://github.com/neverased/NeverBot/commit/d734c4039010305ed74b84a4c53254f1ed50cf3a))
* Update dependencies in package.json ([a3da0cc](https://github.com/neverased/NeverBot/commit/a3da0ccc86cee09aeaa6629de9af51e7fdfd6706))
* Update package dependencies ([9d62404](https://github.com/neverased/NeverBot/commit/9d624043d7bfd1ecbafad77e64579850754c6239))
* Update package dependencies ([37b7b7a](https://github.com/neverased/NeverBot/commit/37b7b7ad5730923d0821071d1e270214fc7d70a3)), closes [#123](https://github.com/neverased/NeverBot/issues/123)
* Update package dependencies and chatbot response ([554cf2c](https://github.com/neverased/NeverBot/commit/554cf2ce67642e7dd1388755b37c99b08d2cc268))
