# Genera l'SQL di import dei reel del 14/11/2026. Uso: python3 scripts/import_2026-11-14.py > out.sql
import json

CASA = 'dc93add3-0c09-467b-ae7d-607f07f1af99'

# nome -> (unita base, reparto, tracciamento, icona)
CAT = {
 # già presenti
 'patate': ('g', None, None, None), 'sale': ('g', None, None, None), 'pepe nero': ('g', None, None, None),
 "olio extravergine d'oliva": ('ml', None, None, None), 'cipolla': ('unita', None, None, None),
 'carote': ('unita', None, None, None), 'salsa di soia': ('ml', None, None, None),
 'concentrato di pomodoro': ('g', None, None, None),
 # nuovi
 'paprika': ('g', 'Condimenti e spezie', 'stato', None),
 'paprika affumicata': ('g', 'Condimenti e spezie', 'stato', None),
 'spezie miste': ('g', 'Condimenti e spezie', 'stato', '🌿'),
 'petto di pollo': ('g', 'Carne e pesce', 'quantita', '🍗'),
 'macinato di pollo': ('g', 'Carne e pesce', 'quantita', '🍗'),
 'carne di manzo magra': ('g', 'Carne e pesce', 'quantita', '🥩'),
 'cornflakes': ('g', 'Colazione e dolci', 'quantita', '🥣'),
 'aglio': ('unita', 'Frutta e verdura', 'stato', '🧄'),
 'uova': ('unita', 'Latticini e uova', 'quantita', '🥚'),
 'maionese light': ('g', 'Condimenti e spezie', 'stato', None),
 'yogurt greco': ('g', 'Latticini e uova', 'quantita', None),
 'senape': ('g', 'Condimenti e spezie', 'stato', None),
 'salsa worcester': ('ml', 'Condimenti e spezie', 'stato', None),
 'succo di limone': ('ml', 'Frutta e verdura', 'quantita', '🍋'),
 'limone': ('unita', 'Frutta e verdura', 'quantita', '🍋'),
 'parmigiano': ('g', 'Latticini e uova', 'quantita', '🧀'),
 'lattuga': ('g', 'Frutta e verdura', 'quantita', '🥬'),
 'pomodorini': ('g', 'Frutta e verdura', 'quantita', '🍅'),
 'sottilette light': ('unita', 'Latticini e uova', 'quantita', '🧀'),
 'prezzemolo': ('g', 'Frutta e verdura', 'stato', '🌿'),
 'crostini di pane': ('g', 'Pane e forno', 'quantita', '🍞'),
 'dolcificante': ('g', 'Colazione e dolci', 'stato', None),
 'pan piuma': ('g', 'Pane e forno', 'quantita', '🍞'),
 'proteine in polvere': ('g', 'Colazione e dolci', 'quantita', None),
 'bevanda vegetale': ('ml', 'Bevande', 'quantita', '🥛'),
 'latte': ('ml', 'Latticini e uova', 'quantita', '🥛'),
 'pangrattato': ('g', 'Pane e forno', 'quantita', '🍞'),
 'origano secco': ('g', 'Condimenti e spezie', 'stato', '🌿'),
 'cocco rapé': ('g', 'Frutta secca e snack', 'quantita', '🥥'),
 'miele': ('g', 'Colazione e dolci', 'stato', '🍯'),
 'cioccolato fondente': ('g', 'Colazione e dolci', 'quantita', '🍫'),
 'cacao amaro': ('g', 'Colazione e dolci', 'stato', '🍫'),
 'riso cotto': ('g', 'Pasta, riso e cereali', 'quantita', '🍚'),
 'acqua': ('ml', 'Altro', 'stato', '💧'),
 'zucchine': ('unita', 'Frutta e verdura', 'quantita', '🥒'),
 'farina': ('g', 'Pasta, riso e cereali', 'quantita', '🌾'),
 'menta': ('g', 'Frutta e verdura', 'stato', '🌿'),
 'riso': ('g', 'Pasta, riso e cereali', 'quantita', '🍚'),
 'ceci cotti': ('g', 'Legumi e conserve', 'quantita', '🫘'),
 'olive': ('g', 'Legumi e conserve', 'quantita', '🫒'),
 'curcuma': ('g', 'Condimenti e spezie', 'stato', None),
 'fagioli cannellini cotti': ('g', 'Legumi e conserve', 'quantita', '🫘'),
 'fagiolini': ('g', 'Frutta e verdura', 'quantita', '🫛'),
 'pesto': ('g', 'Condimenti e spezie', 'quantita', '🌿'),
 'fagioli di spagna cotti': ('g', 'Legumi e conserve', 'quantita', '🫘'),
 'peperoni': ('unita', 'Frutta e verdura', 'quantita', '🫑'),
 'pomodori secchi': ('unita', 'Legumi e conserve', 'quantita', '🍅'),
 'zafferano': ('unita', 'Condimenti e spezie', 'stato', None),
 'amido di mais': ('g', 'Colazione e dolci', 'stato', '🌽'),
 'aroma alla vaniglia': ('ml', 'Colazione e dolci', 'stato', None),
 'fiocchi di latte magri': ('g', 'Latticini e uova', 'quantita', None),
 'sciroppo d\'acero senza zucchero': ('ml', 'Colazione e dolci', 'quantita', '🍯'),
 'farina autolievitante': ('g', 'Pasta, riso e cereali', 'quantita', '🌾'),
 'quinoa': ('g', 'Pasta, riso e cereali', 'quantita', '🌾'),
 'tofu affumicato': ('g', 'Proteine vegetali', 'quantita', None),
 'cetrioli': ('unita', 'Frutta e verdura', 'quantita', '🥒'),
 'cipolla rossa': ('unita', 'Frutta e verdura', 'quantita', '🧅'),
 'rucola': ('g', 'Frutta e verdura', 'quantita', '🥬'),
 'tahina': ('g', 'Condimenti e spezie', 'quantita', None),
 'lamponi': ('g', 'Frutta e verdura', 'quantita', '🍓'),
 'semi di chia': ('g', 'Frutta secca e snack', 'quantita', None),
 'olio di cocco': ('ml', 'Condimenti e spezie', 'stato', '🥥'),
 'aneto': ('g', 'Frutta e verdura', 'stato', '🌿'),
 'bicarbonato': ('g', 'Altro', 'stato', None),
 'riso basmati integrale': ('g', 'Pasta, riso e cereali', 'quantita', '🍚'),
 'salsa barbecue 0 kcal': ('ml', 'Condimenti e spezie', 'stato', None),
 'brodo di pollo': ('ml', 'Condimenti e spezie', 'quantita', '🍲'),
 'rosmarino': ('g', 'Frutta e verdura', 'stato', '🌿'),
 'fogli di carta di riso': ('unita', 'Pasta, riso e cereali', 'quantita', None),
 'cipollotto': ('unita', 'Frutta e verdura', 'quantita', '🧅'),
 'mirin': ('ml', 'Condimenti e spezie', 'stato', None),
 'salsa teriyaki 0 kcal': ('ml', 'Condimenti e spezie', 'stato', None),
 'gochujang': ('g', 'Condimenti e spezie', 'stato', '🌶️'),
 'zenzero': ('g', 'Frutta e verdura', 'stato', '🫚'),
 'olio al peperoncino': ('ml', 'Condimenti e spezie', 'stato', '🌶️'),
}
EVO = "olio extravergine d'oliva"

def I(nome, q=None, testo=None, gruppo=None, fac=False):
    u, rep, tr, _ = CAT[nome]
    d = {'nome': nome, 'unita': u, 'testo_originale': testo}
    if q is not None: d['quantita'] = q
    if rep: d['reparto'] = rep
    if tr: d['tracciamento'] = tr
    if gruppo: d['gruppo'] = gruppo
    if fac: d['facoltativo'] = True
    return d

def P(*testi, gruppo=None):
    return [{'testo': t, **({'gruppo': gruppo} if gruppo else {})} for t in testi]

R = []
def ricetta(**k): R.append(k)

# 1
g1, g2, g3, g4 = 'Patate', 'Pollo', 'Salsa', 'Insalata'
ricetta(reel_id='DXCZsjlDBMU', autore='Alan Valcarenghi', titolo='Insalata Caesar con pollo e patate', porzioni=1,
  minuti_preparazione=15, minuti_cottura=40, tag=['fit', 'proteica', 'piatto unico'],
  note='Circa 650 kcal a porzione (89 g carboidrati, 47 g proteine, 15 g grassi). Patate e pollo si cuociono uno dopo l\'altro nella friggitrice ad aria.',
  ingredienti=[I('patate', 300, '300 g di patate', g1), I('sale', 1, '1 g di sale', g1), I('paprika', None, 'paprika', g1),
    I('pepe nero', None, 'pepe', g1), I('spezie miste', None, 'mix di spezie per patate', g1), I(EVO, 2, '2 ml di olio evo', g1),
    I('petto di pollo', 80, '80 g di petto di pollo', g2), I('cornflakes', 15, '15 g di cornflakes', g2), I('sale', 1, '1 g di sale', g2),
    I('pepe nero', None, 'pepe', g2), I('aglio', None, 'aglio', g2), I('paprika affumicata', None, 'paprika affumicata', g2),
    I('uova', 1, '1 uovo per panare', g2), I(EVO, 1, '1 ml di olio evo', g2),
    I('maionese light', 20, '20 g di maionese light', g3), I('yogurt greco', 60, '60 g di yogurt greco 0%', g3),
    I('senape', 15, '15 g di senape di Digione', g3), I('salsa worcester', 5, '5 ml di salsa Worcester', g3),
    I('succo di limone', 6, '6 ml di succo di limone', g3), I('parmigiano', 10, '10 g di parmigiano', g3),
    I('pepe nero', None, 'pepe', g3), I('aglio', None, 'aglio', g3),
    I('lattuga', 60, '60 g di lattuga', g4), I('pomodorini', None, 'qualche pomodorino', g4),
    I('sottilette light', 2, '2 sottilette light', g4), I('prezzemolo', None, 'prezzemolo fresco', g4),
    I('crostini di pane', 15, 'qualche crostino di pane, circa 15 g', g4)],
  passaggi=P('Taglia le patate a listarelle, condiscile con sale, spezie e olio e cuocile in friggitrice ad aria a 200 °C per circa 30 minuti, mescolando di tanto in tanto.', gruppo=g1)
    + P('Passa il pollo nell\'uovo sbattuto e poi nei cornflakes sbriciolati con sale, pepe, aglio e paprika affumicata.',
        'Cuocilo in friggitrice ad aria a 200 °C per 10-11 minuti con un filo d\'olio.', gruppo=g2)
    + P('Mescola tutti gli ingredienti della salsa.', gruppo=g3)
    + P('In una ciotola unisci lattuga, pomodorini, sottilette a pezzi, prezzemolo e crostini; aggiungi patate e pollo a pezzi e condisci con la salsa.', gruppo=g4))

# 2
ricetta(reel_id='DYhI8Ums8XP', autore='Alan Valcarenghi', titolo='Tamago sando fit', porzioni=1,
  minuti_preparazione=10, minuti_cottura=12, tag=['vegetariana', 'fit', 'proteica', 'snack'],
  note='Servono 3 uova sode: si usano tutti gli albumi e un solo tuorlo. Il panino va lasciato 20 minuti in frigo prima di mangiarlo; chiuso nella pellicola si conserva fino al giorno dopo. Circa 310 kcal (30 g carboidrati, 20,5 g proteine, 11,5 g grassi).',
  ingredienti=[I('uova', 3, '1 uovo intero + 2 albumi (60 g)'), I('maionese light', 20, '20 g di maionese light'),
    I('yogurt greco', 30, '30 g di yogurt greco'), I('senape', 10, '10 g di senape (facoltativa)', fac=True),
    I('sale', 1.5, '1,5 g di sale'), I('dolcificante', 0.3, '0,3 g di dolcificante (¼ di cucchiaino)'),
    I('pan piuma', 60, '2 fette di pan piuma (circa 60 g)')],
  passaggi=P('Lessa le uova in acqua bollente per circa 12 minuti, poi lasciale 5 minuti in acqua fredda con ghiaccio e sbucciale.',
    'Trita grossolanamente gli albumi con un coltello.',
    'In una ciotola schiaccia un tuorlo con una forchetta e mescolalo con maionese, yogurt, senape, sale e dolcificante; poi unisci gli albumi.',
    'Farcisci il pane e lascia riposare il panino in frigo per 20 minuti.'))

# 3
ricetta(reel_id='DZNe4JMtNB3', autore='Nutrizionista per Persone “Normali”', titolo='Budino di uova e proteine', porzioni=2,
  minuti_preparazione=10, minuti_cottura=5, tag=['vegetariana', 'proteica', 'dolce', 'snack'],
  note='Riposo in frigo di almeno 4 ore. In tutto circa 502 kcal (71 g proteine, 21 g grassi, 5 g carboidrati): la nutrizionista lo giudica buonissimo ma troppo calorico per un solo spuntino, voto 5/10. Per questo l\'ho diviso in 2 porzioni.',
  ingredienti=[I('uova', 4, '4 uova'), I('proteine in polvere', 60, '2 misurini di proteine in polvere (circa 60 g)'),
    I('bevanda vegetale', 120, '120 g di bevanda vegetale')],
  passaggi=P('Strapazza le uova in padella.', 'Frullale con le proteine e la bevanda vegetale fino a ottenere una crema.',
    'Lascia riposare in frigo per almeno 4 ore.'))

# 4
gm, gp = 'Marinata', 'Panatura'
ricetta(reel_id='DZw6gzfNjC6', autore='Nutrizionista per Persone “Normali”', titolo='Pollo panato al forno', porzioni=4,
  minuti_preparazione=15, minuti_cottura=30, tag=['proteica', 'secondo', 'sfiziosa'],
  note='Voto della nutrizionista 8/10. Panato: circa 363 kcal per 100 g di petto (29 g proteine, 9 g grassi, 15 g carboidrati); la panatura ha un costo calorico, quindi riduci un po\' carboidrati o grassi nello stesso pasto.',
  ingredienti=[I('petto di pollo', 700, '700 g di petto di pollo a fette', gm), I('latte', 130, '130 ml di latte', gm),
    I(EVO, 40, '40 ml di olio evo', gm), I('succo di limone', 40, '40 ml di succo di limone', gm),
    I('limone', None, 'scorza di limone', gm), I('sale', None, 'sale', gm), I('pepe nero', None, 'pepe', gm),
    I('prezzemolo', None, 'prezzemolo', gm),
    I('pangrattato', 80, '80 g di pangrattato', gp), I('parmigiano', 80, '80 g di parmigiano', gp),
    I('origano secco', None, 'origano secco', gp)],
  passaggi=P('Marina le fette di pollo con latte, olio, succo e scorza di limone, sale, pepe e prezzemolo.', gruppo=gm)
    + P('Passa il pollo nel mix di pangrattato, parmigiano e origano.', 'Cuoci in forno statico a 180 °C per 25-30 minuti.', gruppo=gp))

# 5
ricetta(reel_id='DZzbOePtjsA', autore='Dott.ssa Sara Schellino', titolo='Dolcetti di yogurt greco, cocco e cioccolato', porzioni=3,
  minuti_preparazione=20, minuti_cottura=None, tag=['vegetariana', 'dolce', 'snack'],
  da_verificare=True, note_verifica='Il reel non dà nessuna quantità: le ho stimate dal video, dove vengono circa 6 dolcetti.',
  note='Servono circa 30 minuti di freezer per le palline e qualche ora dopo la copertura. Tirali fuori 5-10 minuti prima di mangiarli per una consistenza più cremosa.',
  ingredienti=[I('yogurt greco', 170, 'yogurt greco'), I('cocco rapé', 40, 'cocco rapé'),
    I('miele', 10, 'un po\' di miele, se ti piace più dolce', fac=True), I('cioccolato fondente', 80, 'cioccolato fondente')],
  passaggi=P('Mescola lo yogurt greco con il cocco rapé e, se vuoi, un po\' di miele.',
    'Forma delle palline su carta forno e mettile in freezer per circa 30 minuti.',
    'Nel frattempo sciogli il cioccolato fondente.',
    'Ricopri le palline con il cioccolato fuso, spolverale con un po\' di cocco e rimettile in freezer per qualche ora.'))

# 6
ricetta(reel_id='DZzqPpRCoVn', autore='Raffaele & Caterina', titolo='Budino light al cioccolato', porzioni=2,
  minuti_preparazione=10, minuti_cottura=9, tag=['vegetariana', 'fit', 'proteica', 'dolce'],
  note='Il tempo di cottura delle uova (9 minuti) è importante per la riuscita. Lascia riposare in frigo prima di servire. Porzioni stimate.',
  ingredienti=[I('uova', 4, '4 uova sode'), I('cacao amaro', 20, '20 g di cacao'),
    I('yogurt greco', 150, '150 g di yogurt greco 0%'), I('dolcificante', None, 'dolcificante (0,1 g di sucralosio) oppure drops')],
  passaggi=P('Cuoci le uova in acqua bollente per 9 minuti, poi raffreddale subito in acqua e ghiaccio e sbucciale.',
    'Frulla le uova con yogurt, cacao e dolcificante fino a una crema densa e liscia.',
    'Versala in tazze e lasciala riposare in frigo. Decora a piacere.'))

# 7
ricetta(reel_id='DZ2pq24o4Ue', autore='Adrianathrr', titolo='Piadina di riso avanzato', porzioni=2,
  minuti_preparazione=10, minuti_cottura=15, tag=['vegana', 'vegetariana', 'fit'],
  note='Va bene qualsiasi quantità di riso cotto: regola l\'acqua finché l\'impasto è morbido e appiccicoso. Non cuocerle troppo, altrimenti diventano croccanti e perdono elasticità. Porzioni stimate.',
  ingredienti=[I('riso cotto', 450, '400-500 g di riso cotto'), I('acqua', 120, '120 ml di acqua'),
    I(EVO, 13, '12 g di olio'), I('sale', None, 'un pizzico di sale, se il riso non era salato', fac=True)],
  passaggi=P('Frulla il riso cotto con acqua, olio e, se serve, un pizzico di sale fino a un impasto morbido, appiccicoso e facile da modellare.',
    'Forma le piadine con le mani.',
    'Cuocile in una padella ben calda senza olio per 3-4 minuti per lato, girandole più volte.'))

# 8
ga, gs = 'Anelli', 'Salsina'
ricetta(reel_id='DaDtlM1iZh8', autore='Raffaele & Caterina', titolo='Anelli croccanti di zucchine al forno', porzioni=4,
  minuti_preparazione=25, minuti_cottura=15, tag=['vegetariana', 'contorno', 'snack', 'sfiziosa'],
  note='Vengono bene anche con la cipolla al posto delle zucchine. Porzioni stimate.',
  ingredienti=[I('zucchine', 3, '3 zucchine', ga), I('farina', 300, '300 g di farina', ga), I('acqua', 300, '300 ml di acqua', ga),
    I('cornflakes', 100, '100 g di cornflakes', ga), I(EVO, None, 'olio', ga), I('sale', None, 'sale', ga),
    I('pepe nero', None, 'pepe', ga), I('spezie miste', None, 'spezie a piacere', ga),
    I('yogurt greco', 100, '100 g di yogurt greco 0%', gs), I(EVO, None, 'olio', gs), I('sale', None, 'sale', gs),
    I('pepe nero', None, 'pepe', gs), I('menta', None, 'menta', gs), I('succo di limone', None, 'succo di limone', gs)],
  passaggi=P('Taglia le zucchine a rondelle né troppo spesse né troppo sottili e ricava degli anelli togliendo il centro con un coppapasta o un coltello.',
      'Cuoci i dischetti centrali in padella con un filo d\'olio e un pizzico di sale finché sono morbidi: servono per la salsina.',
      'Mescola farina, acqua e sale fino a una pastella liscia; a parte sbriciola i cornflakes.',
      'Passa gli anelli nella pastella e poi nei cornflakes, facendoli aderire bene su entrambi i lati.',
      'Cuoci in friggitrice ad aria a 180-200 °C per 10-15 minuti fino a doratura, oppure in forno alla stessa temperatura.', gruppo=ga)
    + P('Frulla o schiaccia i dischetti di zucchina con yogurt, olio, sale, pepe, menta e succo di limone.', gruppo=gs))

# 9 a-c: un reel, tre ricette
comune = lambda: [I(EVO, None, 'un filo d\'olio'), I('sale', None, 'sale')]
passi_mp = lambda verdure: P(verdure,
  'Metti tutti gli ingredienti crudi in un sacchetto per congelatore, anche diviso in porzioni, chiudilo e congelalo.',
  'Quando vuoi cucinarlo, versa il contenuto ancora congelato in una pentola, copri d\'acqua e sala.',
  'Cuoci per 20 minuti e completa con un filo d\'olio.')
nota_mp = 'Meal prep da congelatore: si sporca una sola pentola e si cuoce in 20 minuti. È una delle tre varianti dello stesso reel.'
ricetta(reel_id='DaF5z0CohzJ-1', reel_url='https://www.instagram.com/p/DaF5z0CohzJ/', autore='Eduardo e Francesca | cucina vegetale',
  titolo='Riso con zucchine, ceci e curcuma (meal prep)', porzioni=4, minuti_preparazione=15, minuti_cottura=20,
  tag=['vegana', 'vegetariana', 'meal prep', 'piatto unico'], note=nota_mp,
  ingredienti=[I('riso', 320, '320 g di riso'), I('ceci cotti', 480, '2 barattoli di ceci cotti'), I('zucchine', 4, '4 zucchine'),
    I('prezzemolo', None, '1 mazzolino di prezzemolo'), I('limone', 1, 'la scorza di 1 limone'),
    I('olive', 40, '4 cucchiai di olive'), I('curcuma', 12, '4 cucchiaini di curcuma')] + comune(),
  passaggi=passi_mp('Taglia le zucchine a pezzetti, trita il prezzemolo, grattugia la scorza del limone e scola i ceci.'))
ricetta(reel_id='DaF5z0CohzJ-2', reel_url='https://www.instagram.com/p/DaF5z0CohzJ/', autore='Eduardo e Francesca | cucina vegetale',
  titolo='Riso al pesto con cannellini e fagiolini (meal prep)', porzioni=4, minuti_preparazione=15, minuti_cottura=20,
  tag=['vegana', 'vegetariana', 'meal prep', 'piatto unico'],
  note=nota_mp + ' Per tenerla vegana usa un pesto senza formaggio.',
  ingredienti=[I('riso', 320, '320 g di riso'), I('fagioli cannellini cotti', 480, '2 barattoli di cannellini'),
    I('fagiolini', 300, '300 g di fagiolini'), I('pesto', 60, '4 cucchiai di pesto')] + comune(),
  passaggi=passi_mp('Spunta i fagiolini e tagliali a pezzi, scola i cannellini.'))
ricetta(reel_id='DaF5z0CohzJ-3', reel_url='https://www.instagram.com/p/DaF5z0CohzJ/', autore='Eduardo e Francesca | cucina vegetale',
  titolo='Riso con fagioli di Spagna e peperoni (meal prep)', porzioni=4, minuti_preparazione=15, minuti_cottura=20,
  tag=['vegana', 'vegetariana', 'meal prep', 'piatto unico'], note=nota_mp,
  ingredienti=[I('riso', 320, '320 g di riso'), I('fagioli di spagna cotti', 480, '2 barattoli di fagioli di Spagna'),
    I('peperoni', 2, '2 peperoni'), I('pomodori secchi', 12, '12 pomodori secchi'), I('zafferano', 2, '2 bustine di zafferano')] + comune(),
  passaggi=passi_mp('Taglia i peperoni e i pomodori secchi a pezzetti, scola i fagioli.'))

# 10
ricetta(reel_id='DaIAAZfM79x', autore='Alan Valcarenghi', titolo='Pane basco fit', porzioni=5,
  minuti_preparazione=10, minuti_cottura=60, tag=['vegetariana', 'fit', 'proteica', 'dolce'],
  note='Viene circa 500 g in tutto, 118 kcal ogni 100 g (8,5 g carboidrati, 13,2 g proteine, 3,5 g grassi): l\'ho diviso in 5 porzioni da 100 g. Fallo raffreddare almeno un paio d\'ore prima di mangiarlo.',
  ingredienti=[I('uova', 4, '4 uova'), I('yogurt greco', 400, '400 g di yogurt greco aromatizzato'),
    I('aroma alla vaniglia', None, 'aroma, se lo yogurt non è aromatizzato', fac=True), I('amido di mais', 35, '35 g di amido di mais')],
  passaggi=P('Mescola tutti gli ingredienti con una frusta fino a un composto omogeneo.',
    'Versalo in una teglia con carta forno e cuoci in forno statico a 180 °C per 50-60 minuti.',
    'Lascialo raffreddare almeno un paio d\'ore prima di mangiarlo.'))

# 11
ricetta(reel_id='DahQKqnBLVy', autore='Noah Perlo', titolo='Pancake proteici con fiocchi di latte e cioccolato', porzioni=10,
  minuti_preparazione=15, minuti_cottura=25, tag=['vegetariana', 'proteica', 'colazione', 'meal prep'],
  da_verificare=True,
  note_verifica='Il reel è in inglese con misure in tazze e cucchiai per 30 pancake: ho diviso per 3 e convertito in grammi. Il procedimento non è scritto, l\'ho ricavato dal video.',
  note='Dosi per 10 pancake. Ognuno circa 138 kcal (10 g proteine, 15,5 g carboidrati, 4 g grassi). Si conservano avvolti nella stagnola, anche in freezer. Se non trovi la farina autolievitante usa farina 00 con circa 8 g di lievito per dolci.',
  ingredienti=[I('fiocchi di latte magri', 450, '2 cups low fat cottage cheese'), I('uova', 4, '4 whole eggs'),
    I('aroma alla vaniglia', 5, '1 tsp vanilla extract'), I("sciroppo d'acero senza zucchero", 60, '4 tbsp sugar-free maple syrup'),
    I('farina autolievitante', 155, '1¼ cups self rising flour'), I('cioccolato fondente', 60, '60 g stevia chocolate chips')],
  passaggi=P('Frulla fiocchi di latte, uova, vaniglia e sciroppo fino a una crema liscia.',
    'Versala in una ciotola e incorpora la farina.',
    'Trita il cioccolato e mescolalo all\'impasto.',
    'Cuoci i pancake in una padella calda e leggermente unta, meglio dentro dei coppapasta, girandoli quando la superficie fa le bolle.',
    'Lasciali raffreddare e conservali avvolti nella stagnola.'))

# 12
gq, gc = 'Insalata', 'Condimento'
ricetta(reel_id='DbAkdLajNok', autore='Elena | Green Gourmet', titolo='Insalata proteica di quinoa in barattolo', porzioni=4,
  minuti_preparazione=25, minuti_cottura=15, tag=['vegana', 'vegetariana', 'meal prep', 'proteica', 'piatto unico', 'fit'],
  note='Dosi per 4 barattoli grandi. Mettere il condimento sul fondo e la rucola in alto tiene l\'insalata croccante per giorni.',
  ingredienti=[I('quinoa', 200, '200 g di quinoa', gq), I('tofu affumicato', 360, '360 g di tofu affumicato', gq),
    I('cetrioli', 2, '2 cetrioli medi', gq), I('pomodorini', 250, '250 g di pomodorini', gq), I('cipolla rossa', 1, '1 cipolla rossa', gq),
    I('carote', 2, '2 carote grandi', gq), I('ceci cotti', 240, '240 g di ceci', gq), I('rucola', 40, '2 manciate di rucola', gq),
    I('olive', 50, '16 olive', gq), I('pomodori secchi', 8, "8 pomodori secchi sott'olio", gq),
    I('tahina', 150, '150 g di tahina', gc), I('succo di limone', 80, '80 g di limone', gc), I(EVO, 40, '4 cucchiai di olio evo', gc),
    I('acqua', 150, '10 cucchiai di acqua tiepida', gc), I('salsa di soia', 90, '6 cucchiai di salsa di soia', gc), I('sale', None, 'sale', gc)],
  passaggi=P('Cuoci la quinoa come indicato sulla confezione e lasciala raffreddare.',
      'Taglia a tocchetti cetrioli, carote e cipolla, i pomodorini in quarti e il tofu a cubetti medi.',
      'Taglia le olive a metà e i pomodori secchi a pezzetti.', gruppo=gq)
    + P('Mescola tutti gli ingredienti del condimento.', gruppo=gc)
    + P('Riempi i barattoli partendo dal condimento, poi tofu, cetrioli, pomodorini, cipolla, carote, ceci, quinoa, rucola, pomodori secchi e olive.', gruppo='Composizione'))

# 13
ricetta(reel_id='DbWHrUJuUhk', autore='Irene Pérez', titolo='Dischetti di lamponi, chia e cioccolato', porzioni=7,
  minuti_preparazione=20, minuti_cottura=None, tag=['vegana', 'vegetariana', 'dolce', 'snack'],
  note='Dosi per 14 dischetti (2 a porzione). Si conservano in freezer. Se li vuoi più dolci aggiungi ai lamponi un dolcificante, per esempio un cucchiaio di miele o di pasta di datteri (il miele non è vegano). Ricetta originale in spagnolo.',
  ingredienti=[I('lamponi', 300, '300 g di lamponi'), I('semi di chia', 30, '3 cucchiai di semi di chia'),
    I('cioccolato fondente', 200, '200 g di cioccolato fondente almeno al 75%'), I('olio di cocco', 5, '1 cucchiaino di olio di cocco'),
    I('dolcificante', None, 'dolcificante a piacere', fac=True)],
  passaggi=P('Schiaccia i lamponi e mescolali con i semi di chia.',
    'Forma dei dischetti su carta forno e mettili in freezer per almeno 40 minuti.',
    'Sciogli il cioccolato con l\'olio di cocco e immergi i dischetti, poi rimettili in freezer finché il cioccolato si indurisce.'))

# 14
ricetta(reel_id='Dbiy6HRs6K3', autore='Alan Valcarenghi', titolo='Salsa tzatziki fit', porzioni=8,
  minuti_preparazione=15, minuti_cottura=None, tag=['vegetariana', 'fit', 'proteica', 'meal prep'],
  note='Vengono circa 850 g, divisi in 8 porzioni da 100 g: 49 kcal ogni 100 g (2 g carboidrati, 6,2 g proteine, 1,8 g grassi). Si conserva in frigo fino a 4 giorni.',
  ingredienti=[I('yogurt greco', 500, '500 g di yogurt greco 0%'), I('cetrioli', 1, '1 cetriolo medio'),
    I('aglio', None, 'aglio fresco o in polvere'), I('limone', 0.5, 'succo di mezzo limone'), I('pepe nero', None, 'pepe'),
    I('sale', 3, '3 g di sale'), I('dolcificante', 0.4, '0,4 g di dolcificante'), I(EVO, 15, '15 ml di olio evo'),
    I('prezzemolo', None, 'prezzemolo fresco'), I('aneto', None, 'aneto fresco')],
  passaggi=P('Grattugia il cetriolo e strizzalo bene per togliere l\'acqua.',
    'Mescola in una ciotola con tutti gli altri ingredienti.'))

# 15
ricetta(reel_id='DdQ7PcTN13W', autore='Nutrizionista per Persone “Normali”', titolo='Bistek tagalog con riso basmati', porzioni=2,
  minuti_preparazione=15, minuti_cottura=25, tag=['proteica', 'fit', 'piatto unico'],
  da_verificare=True,
  note_verifica='La maizena è tra gli ingredienti ma non nel procedimento: l\'ho messa nella marinata. La cipolla è nel procedimento ma non tra gli ingredienti: quantità da decidere.',
  note='Va preparata in anticipo: la carne riposa almeno 30 minuti (meglio un\'ora) col bicarbonato. Scegli un taglio magro e usa pochissimo olio. Consigliato aggiungere una verdura, per esempio fagiolini fini. Voto 9/10. A porzione con il riso circa 578 kcal (42,2 g proteine, 67,1 g carboidrati, 13,8 g grassi).',
  ingredienti=[I('carne di manzo magra', 300, '300 g di carne magra'), I('bicarbonato', 10, '1 cucchiaio di bicarbonato'),
    I('amido di mais', 10, '1 cucchiaio di maizena'), I('riso basmati integrale', 80, '80 g di riso basmati integrale'),
    I('cipolla', None, 'cipolla'), I(EVO, None, 'olio'), I('salsa di soia', None, 'salsa di soia'),
    I('succo di limone', None, 'limone'), I('aglio', None, 'aglio'), I('pepe nero', None, 'pepe')],
  passaggi=P('Taglia la carne a fette sottili, aggiungi il bicarbonato e un po\' d\'acqua, mescola e lascia in frigo almeno 30 minuti, meglio un\'ora.',
    'Sciacqua molto bene la carne e marinala con salsa di soia, succo di limone e maizena.',
    'Cuoci il riso.',
    'Rosola la carne in padella con pochissimo olio e mettila da parte.',
    'Nella stessa padella versa altra salsa di soia, succo di limone e aglio tritato e aggiungi la cipolla.',
    'Quando la cipolla è appassita rimetti la carne e cuoci altri 5-10 minuti, poi servi sul riso.'))

# 16
ricetta(reel_id='Ddv6vfhoyJb', autore='Alan Valcarenghi', titolo='Pulled chicken fit', porzioni=8,
  minuti_preparazione=15, minuti_cottura=70, tag=['proteica', 'fit', 'meal prep', 'secondo'],
  note='Il pollo marina un\'ora prima della cottura. Il concentrato è tra gli ingredienti ma non nel procedimento: aggiungilo alla marinatura. Circa 116 kcal ogni 100 g (1,7 g carboidrati, 20,3 g proteine, 2,5 g grassi). Porzioni stimate.',
  ingredienti=[I('petto di pollo', 1500, '1,5 kg di petto di pollo'), I('cipolla', 2, '2 cipolle'),
    I('salsa barbecue 0 kcal', 60, '60 ml di salsa BBQ 0 kcal'), I(EVO, None, "un filo d'olio evo"), I('aglio', None, 'aglio'),
    I('paprika', None, 'paprika'), I('pepe nero', None, 'pepe'), I('sale', 1, '1 g di sale'),
    I('concentrato di pomodoro', 10, '10 g di concentrato di pomodoro'), I('salsa di soia', 30, '30 ml di salsa di soia poco sale'),
    I('brodo di pollo', 500, '500 ml di brodo di pollo')],
  passaggi=P('Marina il pollo per un\'ora con salsa barbecue, aglio, paprika, salsa di soia, concentrato e brodo.',
    'Fai ammorbidire la cipolla in padella con un filo d\'olio e un po\' d\'acqua.',
    'Scotta il pollo per qualche minuto a fiamma alta.',
    'Aggiungi tutta la marinatura, copri e cuoci a fiamma dolce per circa un\'ora.',
    'Togli il pollo, sfilaccialo e fai restringere il sugo in padella.', 'Unisci il pollo sfilacciato al sugo.'))

# 17
ricetta(reel_id='DeT7rA9IyNo', autore='Alan Valcarenghi', titolo='Smash potatoes fit', porzioni=2,
  minuti_preparazione=10, minuti_cottura=50, tag=['vegetariana', 'fit', 'contorno', 'sfiziosa'],
  note='Le dosi del reel sono per una patata da circa 80 g (105 kcal l\'una): qui sono per 4 patate, 2 a testa come contorno.',
  ingredienti=[I('patate', 320, '4 patate medio-piccole da circa 80 g'), I('rosmarino', None, 'rosmarino'),
    I('aglio', None, 'aglio'), I('paprika', None, 'paprika dolce'), I('sale', None, 'sale'), I('pepe nero', None, 'pepe'),
    I('parmigiano', 40, '10 g di parmigiano a patata'), I(EVO, 4, '1 ml di olio evo a patata')],
  passaggi=P('Lessa le patate finché un coltello le attraversa senza fatica.',
    'Mettile su una teglia con carta forno e schiacciale fino a renderle sottili.',
    'Spalma sopra spezie e sale, spruzza l\'olio e copri con il parmigiano.',
    'Cuoci in friggitrice ad aria o in forno ventilato a 190 °C per 25-30 minuti.'))

# 18
gr, gd = 'Ripieno', 'Per decorare'
ricetta(reel_id='DfC65dKtV63', autore='Alan Valcarenghi', titolo='Ravioli cinesi istantanei fit', porzioni=4,
  minuti_preparazione=30, minuti_cottura=15, tag=['proteica', 'fit', 'sfiziosa', 'secondo'],
  note='Dosi per 20 ravioli (5 a porzione), circa 34 kcal l\'uno (4,1 g carboidrati, 3 g proteine, 0,6 g grassi). Assaggiane uno per controllare che il ripieno sia ben cotto prima di servire.',
  ingredienti=[I('fogli di carta di riso', 20, '20 fogli di riso piccoli (circa 5 g l\'uno)'),
    I('cipollotto', 1, '1 cipollotto bianco', gr), I('macinato di pollo', 200, '200 g di macinato di pollo o tacchino', gr),
    I('salsa di soia', 30, '30 ml di salsa di soia poco sale', gr), I('mirin', 7, '7 ml di mirin', gr),
    I('brodo di pollo', 40, '40 ml di brodo di pollo', gr), I('salsa teriyaki 0 kcal', 20, '20 ml di salsa teriyaki 0 kcal', gr),
    I('gochujang', 15, '15 g di gochujang', gr), I('aglio', None, 'aglio', gr), I('zenzero', None, 'zenzero', gr),
    I('pepe nero', None, 'pepe', gr), I(EVO, None, "un filo d'olio per la cottura"),
    I('olio al peperoncino', None, 'olio al peperoncino', gd, fac=True), I('cipollotto', None, 'cipollotto verde', gd, fac=True)],
  passaggi=P('Mescola tutti gli ingredienti del ripieno in una ciotola.',
    'Bagna leggermente un foglio di riso, taglialo a metà, sovrapponi le due metà e tagliale ancora a metà.',
    'Sovrapponi i pezzi dalle punte, metti il ripieno al centro e chiudi sigillando bene i bordi. Ripeti con gli altri fogli.',
    'Rosola la base dei ravioli in una padella calda con un filo d\'olio per qualche minuto.',
    'Aggiungi un goccio d\'acqua e cuoci a fiamma medio-bassa per circa 10 minuti; quando l\'acqua è evaporata lasciali ancora un po\' senza bruciarli.',
    'Servi con olio al peperoncino e cipollotto verde, se ti piacciono.'))

out = ['begin;']
for r in R:
    r.setdefault('reel_url', f"https://www.instagram.com/p/{r['reel_id']}/")
    r.setdefault('da_verificare', False)
    j = json.dumps(r, ensure_ascii=False)
    out.append(f"select public.importa_ricetta('{CASA}', $j${j}$j$::jsonb);")
for nome, (_, _, _, icona) in CAT.items():
    if icona:
        n = nome.replace("'", "''")
        out.append(f"update public.ingredienti set icona = '{icona}' where nome = '{n}' and icona is null;")
for alias, nome in [('yogurt greco 0%', 'yogurt greco'), ('ceci', 'ceci cotti'), ('maizena', 'amido di mais'),
                    ('cetriolo', 'cetrioli'), ('cannellini', 'fagioli cannellini cotti'), ('cottage cheese', 'fiocchi di latte magri')]:
    out.append(f"insert into public.alias_ingredienti (casa_id, alias, ingrediente_id) select casa_id, '{alias}', id from public.ingredienti where nome = '{nome}' on conflict do nothing;")
out.append('commit;')
print('\n'.join(out))
