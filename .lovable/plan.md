Nitarekebisha mambo mawili: reset ya nywila ifanye kazi kwa njia rasmi ya recovery, na kuongeza download ya data kwa Excel.

Mpango:

1. Kurekebisha “Umesahau nywila”
   - Nirudishe kutuma email ya reset kwa njia sahihi ya kubadili nywila, si OTP ya login.
   - Link itafungua `/reset-password` na kushika session/code/token vizuri kabla ya mtumiaji kuweka nywila mpya.
   - Nitaondoa flow ya OTP inayochanganya mtumiaji ikiwa si lazima, na kuweka ujumbe rahisi wa kosa/link kuisha muda.

2. Kurekebisha ukurasa wa kuweka nywila mpya
   - Field za “Nywila mpya” na “Rudia nywila” zibaki zinaandikika wakati wote link ikiwa halali.
   - Onyesha/Ficha ifanye kazi kwa fields zote mbili bila kuzuia kuandika.
   - Baada ya `updateUser({ password })` kufanikiwa, mtumiaji aelekezwe kwenye kuingia au dashboard bila kuleta “Invalid login credentials”.

3. Kuongeza Excel download ya data
   - Nitaongeza server function inayokusanya data za mtumiaji wake tu: vifaa, readings, alerts, commands, weather snapshots, na advice logs.
   - Nitaongeza kitufe cha “Pakua Excel” kwenye dashboard au settings.
   - Download itatengeneza `.xlsx` browser-side kwa sheets tofauti ili iwe rahisi kusoma kwenye Excel.

4. Uthibitishaji
   - Nitajaribu UI ya show/hide na form ya reset kwa browser.
   - Nitahakikisha kitufe cha Excel kinapakua file na kina data kwa format inayofunguka kwenye Excel.
