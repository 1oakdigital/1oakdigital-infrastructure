export interface CloudflareDomain {
  readonly zoneId: string;
  readonly domain: string;
}

export const adminDomains: CloudflareDomain[] = [
  {
    zoneId: "31c266e8df0a4323aa7e9e51b6459a38",
    domain: "chatadminboard.com",
  },
  {
    zoneId: "135594835099091f9d8b8767d5b2f6aa",
    domain: "chatadminwork.com",
  },
  {
    zoneId: "1ee1187a527947e2a3f96ad65218ae5a",
    domain: "chatcentersite.com",
  },
  {
    zoneId: "77041ce6724fa2697d930e92e179298e",
    domain: "chatforwork.com",
  },
  {
    zoneId: "18a1517e40ba98a53e548e5ac01223f8",
    domain: "chatmastersite.com",
  },
  {
    zoneId: "59e6e7f6b7327729459e7faf48d4d3b7",
    domain: "chatmasterwork.com",
  },
  {
    zoneId: "03071ff5c8c64e3a830d3b1058cc6f4b",
    domain: "ichatcenter.com",
  },
  {
    zoneId: "f13083eef1b22c10ae96f431475c807c",
    domain: "justchatcentral.com",
  },
  {
    zoneId: "2a9bd60b44f01a41106937f7579d816a",
    domain: "justchatwork.com",
  },
  {
    zoneId: "03999fa339032b1619691015f5bf082a",
    domain: "messageforwork.com",
  },
  {
    zoneId: "f67f335f1bbaecc1289cc57c3ff70fd7",
    domain: "messagemastersite.com",
  },
  {
    zoneId: "289b5086092610feb7281ccfbc4ec01f",
    domain: "msgadmin.com",
  },
  {
    zoneId: "463b43b2271bd45ef1733f89e95e6e9f",
    domain: "msgdashboard.com",
  },
  {
    zoneId: "4a2d9b5bd1cac598c0fe181ccfa1f5b9",
    domain: "mychatadmin.com",
  },
  {
    zoneId: "040a43ad49a34058da42571addc2ebda",
    domain: "mychatwork.com",
  },
  {
    zoneId: "1607192baac6271f6f29187fe22d1204",
    domain: "pokesadmin.com",
  },
  { zoneId: "0aa7196612777c8cfc8228cac6901525", domain: "sloopadmin.com" },
];
export const websiteDomains: CloudflareDomain[] = [
  { domain: "aussiebang.com", zoneId: "f9d8d65bc5831a0afc621d83c0567859" },
  { domain: "bangtender.com", zoneId: "632ba229da1201228d0e42849dd01207" },
  { domain: "deliamigos.com", zoneId: "d5ef3fbe35e250d708bcbaad08f5bb58" },
  { domain: "duknulla.com", zoneId: "d51d0af7e814835e6e3e95a2c40df5de" },
  { domain: "flingpals.com", zoneId: "048d08acc2672b86c49d7cb89e25c917" },
  { domain: "flirtytown.com", zoneId: "58c77199b859ab0682805fc191ac250a" },
  { domain: "follarico.com", zoneId: "0b8b830fddf6745e5156135594236e68" },
  { domain: "geheimerfick.com", zoneId: "b567b40bcd38304c200c3b6759bb6ef7" },
  { domain: "geheimneuken.com", zoneId: "2e39d69323dda65bfaffcfb2255e72de" },
  { domain: "honeynearby.com", zoneId: "60e6258fbd0ae9e4e3c59bc05a4561c0" },
  { domain: "horneyfriends.com", zoneId: "82d3045fefc510b483f5974b41f478d0" },
  { domain: "ilsessuali.com", zoneId: "47134c03bba84ecf21530ac10be8fe5f" },
  { domain: "jijneukt.com", zoneId: "60472b523af4f1db98c640544b0f23ab" },
  { domain: "laissebaiser.com", zoneId: "2e000e4a709cebc4d5ff31b723d4b3e3" },
  { domain: "loversnextdoor.com", zoneId: "a7910017e35bc2f245448c00bb3afbc5" },
  { domain: "lustpals.com", zoneId: "c6616ed06b7b2637b8f9334485e5c67c" },
  { domain: "meltingme.com", zoneId: "019fe3f0034b9f43e663f0766734895f" },
  { domain: "mycrushfinder.com", zoneId: "b80ca7369e34a1fb270024b5840fbe1a" },
  { domain: "myflingmate.com", zoneId: "a861bfc488a7f7f130b365f29e5584ac" },
  { domain: "mysecretfeels.com", zoneId: "a11c675bace07f7412c87da77e838cc9" },
  { domain: "pourjouir.com", zoneId: "2fe570c944b0afbcc53492d4365b7fb7" },
  { domain: "rabbitsmeet.com", zoneId: "b507d99730f1b4573f7af87d61c8a743" },
  { domain: "ragazzevicino.com", zoneId: "0727ef6dc8602ad4609bd475c958e758" },
  { domain: "seekingcrush.com", zoneId: "c7b1f57a7d707fe0674f53e736cfb1c3" },
  { domain: "sexosecreto.com", zoneId: "b1e2ba5b01b6ab691364e73fd4a6e90c" },
  { domain: "shag2night.com", zoneId: "fe7d776e2617c4858abc248460cb27f3" },
  { domain: "spicywives.com", zoneId: "5ddfb3aa6dc00a70ba9e401391b9e494" },
  { domain: "yummyaffair.com", zoneId: "20d81dd86be6cacbc86c59d7d132c363" },
];

export const allDomains: CloudflareDomain[] = [
  ...adminDomains,
  ...websiteDomains,
];

export const domainZoneMap: { [key: string]: string } = {
  "aussiebang.com": "f9d8d65bc5831a0afc621d83c0567859",
  "bangtender.com": "632ba229da1201228d0e42849dd01207",
  "chatadminboard.com": "31c266e8df0a4323aa7e9e51b6459a38",
  "chatadminwork.com": "135594835099091f9d8b8767d5b2f6aa",
  "chatcentersite.com": "1ee1187a527947e2a3f96ad65218ae5a",
  "chatforwork.com": "77041ce6724fa2697d930e92e179298e",
  "chatmastersite.com": "18a1517e40ba98a53e548e5ac01223f8",
  "chatmasterwork.com": "59e6e7f6b7327729459e7faf48d4d3b7",
  "deliamigos.com": "d5ef3fbe35e250d708bcbaad08f5bb58",
  "duknulla.com": "d51d0af7e814835e6e3e95a2c40df5de",
  "flingpals.com": "048d08acc2672b86c49d7cb89e25c917",
  "flirtytown.com": "58c77199b859ab0682805fc191ac250a",
  "follarico.com": "0b8b830fddf6745e5156135594236e68",
  "geheimerfick.com": "b567b40bcd38304c200c3b6759bb6ef7",
  "geheimneuken.com": "2e39d69323dda65bfaffcfb2255e72de",
  "honeynearby.com": "60e6258fbd0ae9e4e3c59bc05a4561c0",
  "horneyfriends.com": "82d3045fefc510b483f5974b41f478d0",
  "ichatcenter.com": "03071ff5c8c64e3a830d3b1058cc6f4b",
  "ilsessuali.com": "47134c03bba84ecf21530ac10be8fe5f",
  "jijneukt.com": "60472b523af4f1db98c640544b0f23ab",
  "justchatcentral.com": "f13083eef1b22c10ae96f431475c807c",
  "justchatwork.com": "2a9bd60b44f01a41106937f7579d816a",
  "laissebaiser.com": "2e000e4a709cebc4d5ff31b723d4b3e3",
  "loversnextdoor.com": "a7910017e35bc2f245448c00bb3afbc5",
  "lustpals.com": "c6616ed06b7b2637b8f9334485e5c67c",
  "meltingme.com": "019fe3f0034b9f43e663f0766734895f",
  "messageforwork.com": "03999fa339032b1619691015f5bf082a",
  "messagemastersite.com": "f67f335f1bbaecc1289cc57c3ff70fd7",
  "msgadmin.com": "289b5086092610feb7281ccfbc4ec01f",
  "msgdashboard.com": "463b43b2271bd45ef1733f89e95e6e9f",
  "mychatadmin.com": "4a2d9b5bd1cac598c0fe181ccfa1f5b9",
  "mychatwork.com": "040a43ad49a34058da42571addc2ebda",
  "mycrushfinder.com": "b80ca7369e34a1fb270024b5840fbe1a",
  "myflingmate.com": "a861bfc488a7f7f130b365f29e5584ac",
  "mysecretfeels.com": "a11c675bace07f7412c87da77e838cc9",
  "pokesadmin.com": "1607192baac6271f6f29187fe22d1204",
  "pourjouir.com": "2fe570c944b0afbcc53492d4365b7fb7",
  "rabbitsmeet.com": "b507d99730f1b4573f7af87d61c8a743",
  "ragazzevicino.com": "0727ef6dc8602ad4609bd475c958e758",
  "seekingcrush.com": "c7b1f57a7d707fe0674f53e736cfb1c3",
  "sexosecreto.com": "b1e2ba5b01b6ab691364e73fd4a6e90c",
  "shag2night.com": "fe7d776e2617c4858abc248460cb27f3",
  "spicywives.com": "5ddfb3aa6dc00a70ba9e401391b9e494",
  "yummyaffair.com": "20d81dd86be6cacbc86c59d7d132c363",
  "sloopadmin.com": "0aa7196612777c8cfc8228cac6901525",
};
