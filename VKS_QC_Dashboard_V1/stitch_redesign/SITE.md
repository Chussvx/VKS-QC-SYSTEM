# VKS QC Dashboard Redesign: Site Vision

## Vision
To redesign the VKS Quality Control Dashboard into a modern, unified, and professional interface that adheres strictly to the VKS Design System. The new dashboard will feature a consistent sidebar, standard header, and premium "shadcn/UI" aesthetic with Noto Sans typography, serving both English and Lao users efficiently.

---

## Stitch Configuration
**Project**: VKS QC Dashboard Redesign
**ID**: (See stitch.json)
**Design System**: [DESIGN.md](./DESIGN.md)

---

## Component Status

### Phase 1: Core Layout (High Priority)
- [x] Dashboard (TEMPLATE) - Screens: `435fe65a44be44eab1336c8e4ab1e9fe`, `19286f8295124e609b46089e8c906227`

### Phase 2: High Priority Pages
- [x] Sites - Screen: `62e4cc8c68564846a3f995ab4ad42b1b`
- [x] Guards - Screen: `71e3e767269d43bbbb12824a56a77969`
- [x] PatrolStatus - Screen: `d969f31973024d38b393836d960eb34c`
- [x] InspectionLogs - Screen: `42ad10bc788f4121bbe7a922ea9978bb`

### Phase 3: Medium Priority Pages
- [x] Incidents - Screen: `027e039d63244fe696165f9f8ec87a94`
- [x] Complaints - Screen: `180ef2d3db9e490bba71532b8e4b5ac9`
- [x] Handover - Screen: `0e94a3af9dd34ab585beceee68629245`
- [x] GuardActivity - Screen: `b68c7c4909ab4128b11ef8e2dd9621ac`
- [x] Reports - Screen: `e8b6a55c3589456bb04ef15ae543f53c`
- [x] Performance - Screen: `f77726b0267e44f5941e6bec7d5ad58c`

### Phase 4: Low Priority Pages
- [x] Calendar - Screen: `d0b4f783079f4f3ea7c1ce9e350023c1`
- [x] Overtime - Screen: `d2af6c7518ef4b559ee634d4cb3e9bf0`
- [x] QRGenerator - Screen: `77c4fe8beaa2403ab5d02451dd398fca`
- [x] SiteMap - Screen: `6d80b0f2835f4b40889bd72993ed3f58`
- [x] Settings - Screen: `9f8dedfeae6946439b244d5bb61ef84e`
- [x] PublicInfo - Screen: `25ab123cfd1c48f297f8e6a7edfd1f36`

### Phase 5: Modals
- [x] Modal_Dashboard - Screens: `3f81bb50c7c14d12b626f42f547ad126`, `35c2aaa682e749bd9dcd79094f6330e0`
- [x] Modal_Sites - Screens: `1a171ef5ff974501913bc918c3a7b830`, `9b4a7adb63154dd58d16b2a2363d3d58`
- [x] Modal_Guards - Screens: `ed36dcb0f6e34cd0ae57c2915969487b`, `4c9d52cbcaf843758d8b79cb1d8eed12`
- [x] Modal_Inspection - Screens: `47bc75d743a5419babefe9d0f57d8182`, `9fc77edbbe914bd0ab308916fe135ce1`
- [x] Modal_Issues - Screens: `3879348f2cc94c1aa6e0fdcc8302c4d3`, `76f8e8caae914c0e9dcf121fe8fee130`
- [x] Modal_Handover - Screens: `e32b971445aa4002b94cbd2391ba15c9`, `4eb3887b6d2048d7a5f8c35c3190173f`
- [x] Modal_Reports - Screens: `2da72f068caa47c5a7a9dd59de2442a5`, `56a8a9f8aa1e4186929643a85e080a27`
- [x] Modal_Calendar - Screens: `93aabc6f712140fea7d931286ee5bf68`, `c4c723dc56984b908f75ca7b076d0044`
- [x] Modal_Overtime - Screens: `848a755900964218b7ff2927ccaddc28`, `e0fd5506e2d242ea94abbad6cb8ca33f`
- [x] Modal_QRSettings - Screens: `869c924f9363485eba5171a0faccada3`, `18cd2d2d2bb948f3aced1ca555a5bc7d`
- [x] Modal_Checkpoints - Screens: `a4b901d06f1449e089a9583793612ae1`, `0c2d4c55cfbe48898257f85ee33f9187`
- [x] Modal_Confirm - Screens: `cd9d006d6c5245b9af6ae4ee3e2a1f36`, `e6dada1cacec436abd4ef3945a260310`

---

## Roadmap

1. **Establish the "Golden Template" (Dashboard)**
   - Create the sidebar navigation (consistent across all pages)
   - Create the sticky header (search, profile)
   - Define the main content container styles

2. **Propagate Layout**
   - Use the Dashboard's sidebar/header HTML for all other pages

3. **Generate Content**
   - Iterate through the page list by priority
   - Generate modals as standalone components
