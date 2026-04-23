export const VOICE_LEXICON = {
  fillerWords: [
    'please', 'okay', 'ok', 'ah', 'uh', 'um', 'hmm', 'hm', 'oh', 'yeah', 'yes',
    'hey', 'hello', 'hi', 'just', 'quickly', 'kindly', 'simply',
    'add', 'enter', 'put', 'save', 'note', 'record', 'log',
    'please add', 'please save', 'please note',
    'just add', 'just save', 'just put', 'just note',
    'ok add', 'ok save', 'okay add', 'okay note',
    'quickly add', 'quickly note', 'add this', 'save this', 'note this',

    'suno', 'arey', 'arre', 'arrey', 'acha', 'achha', 'accha', 'haan', 'han',
    'yaar', 'bhai', 'bhaiya', 'bro', 'boss', 'dost', 'zara', 'thoda', 'ek baar',
    'dekho', 'bolo', 'bol', 'sun', 'suniye', 'sunna',

    'da', 'dei', 'di', 'pa', 'anna', 'akka', 'macha', 'machan', 'machi',
    'seri', 'sari', 'sollu', 'thambi', 'chellam', 'dei pa',

    'chetta', 'chechi', 'aliya', 'mwone', 'mone', 'mon', 'mole', 'eda', 'edi',
    'sheriya', 'alle', 'ketto', 'athe', 'eda chetta', 'eda aliya'
  ],

  weakNoiseWords: [
    'a', 'an', 'the', 'and', 'or', 'but',
    'is', 'are', 'am', 'was', 'were', 'be', 'been', 'being',
    'this', 'that', 'these', 'those',
    'some', 'any', 'very', 'much', 'also', 'too',
    'with', 'about', 'into', 'around',
    'my', 'his', 'her', 'our', 'their',
    'wala', 'wali', 'wale', 'ka', 'ki', 'ke',
    'oda', 'nte', 'de', 'la', 'nu'
  ],

  expenseCategories: {
    Food: [
      'food', 'meal', 'meals', 'eating', 'eat', 'ate',
      'breakfast', 'lunch', 'dinner', 'supper', 'brunch',
      'tiffin', 'tiffen', 'tifin',
      'khana', 'khaana', 'khane', 'khane ka',
      'saapadu', 'sapadu', 'sappadu', 'saapad', 'sapad',
      'choru', 'oonu', 'bhojanam', 'bhojan', 'oota',
      'mess food', 'canteen food', 'mess', 'canteen meal',
      'thali', 'meals plate', 'full meals',
      'roti', 'chapati', 'parotta', 'porotta', 'naan',
      'rice meal', 'fried rice', 'biryani', 'biriyani', 'briyani',
      'idli', 'dosa', 'poori', 'pongal', 'upma', 'uthappam',
      'meal expense', 'food expense', 'eating expense',
      'lunch expense', 'dinner expense', 'breakfast expense'
    ],

    Petrol: [
      'petrol', 'petro', 'petral', 'petroll', 'petrola',
      'fuel', 'fuell', 'refuel', 'fuel fill', 'fueling',
      'diesel', 'diesal', 'deisel',
      'bunk', 'pump', 'petrol pump', 'petrol bunk', 'fuel station',
      'filling station', 'full tank', 'half tank', 'tank full',
      'petrol expense', 'fuel expense',
      'petrol dala', 'fuel dala', 'petrol bharwa',
      'petrol adichu', 'petrol adichitu', 'petrol potu', 'bunk la pottu'
    ],

    Smoke: [
      'smoke', 'smoking', 'smoked',
      'cigarette', 'cigarettes', 'cigaret', 'cigratte', 'cigrate', 'cigarrette',
      'cigar', 'cigars', 'ciggy', 'ciggies',
      'beedi', 'bidi', 'beedis',
      'sutta', 'sutte', 'suttey',
      'sigaret', 'sigrettu', 'sigret',
      'smoke expense', 'cigarette expense', 'smokes',
      'gold flake', 'classic', 'kings', 'marlboro', 'malboro'
    ],

    Liquor: [
      'liquor', 'likkar', 'likar', 'liqour',
      'alcohol', 'alchohol', 'alchohal',
      'beer', 'beers',
      'drink', 'drinks', 'drinking',
      'wine', 'rum', 'vodka', 'whisky', 'whiskey', 'wiskey',
      'brandy', 'gin', 'scotch', 'bourbon',
      'bar', 'pub', 'booze',
      'daaru', 'daru', 'daroo', 'sharab', 'sharrab',
      'peg', 'quarter', 'half bottle', 'full bottle',
      'sarakku', 'saraku', 'sarukku', 'kallu',
      'kudi', 'kudichu', 'kudichitu',
      'bevco', 'tasmac', 'tasmak', 'shaappu',
      'liquor expense', 'alcohol expense', 'drinks expense', 'beer expense'
    ],

    'Electricity Bill': [
      'electricity', 'electricity bill', 'electric bill', 'electrical bill',
      'power bill', 'power charge', 'power payment',
      'current', 'current bill', 'current charge', 'current payment',
      'light bill', 'light charge',
      'eb', 'eb bill', 'eb payment', 'eb charge',
      'bijli', 'bijli bill', 'bijli ka bill', 'light ka bill',
      'kseb', 'kseb bill', 'tneb', 'tneb bill', 'bescom', 'bescom bill', 'mseb', 'mseb bill',
      'meter bill', 'electricity expense',
      'current kattinom', 'eb kattitten', 'current bill katti'
    ],

    'Water Bill': [
      'water bill', 'water charge', 'water payment', 'water tax',
      'water board', 'metro water', 'tap water bill', 'water expense',
      'pani bill', 'paani bill', 'pani ka bill',
      'thanni bill', 'thanni charge',
      'vella bill', 'vellam bill',
      'water board bill', 'drinking water bill',
      'watr bill', 'watter bill'
    ],

    'Mobile Recharge': [
      'recharge', 're charge', 'recharg', 'recharje', 'recharche',
      'mobile recharge', 'phone recharge', 'sim recharge',
      'topup', 'top up', 'top-up', 'toppup',
      'data recharge', 'data pack', 'data plan', 'net pack', 'net recharge',
      'talktime', 'talktime recharge',
      'prepaid', 'prepaid recharge', 'postpaid bill', 'phone bill', 'mobile bill',
      'validity recharge', 'plan recharge', 'internet recharge',
      'jio recharge', 'airtel recharge', 'vi recharge', 'bsnl recharge',
      'mobile topup', 'phone top up',
      'recharge kiya', 'mobile bhara', 'recharge panitten', 'recharge cheythu'
    ],

    Groceries: [
      'groceries', 'grocery', 'grocries', 'grosary', 'grossery', 'grosery', 'grocry', 'groocery',
      'ration', 'rations', 'kirana', 'kirana store',
      'maligai', 'malikai', 'maligai saman',
      'palacharakku', 'palacharaku',
      'provisions', 'provision store', 'provision',
      'household items', 'home needs', 'daily needs', 'essentials', 'monthly items',
      'general store items', 'grocery items', 'monthly groceries',
      'milk', 'paal',
      'curd', 'dahi', 'thayir', 'thairu',
      'bread',
      'rice', 'arisi', 'ari', 'chawal',
      'atta', 'maida', 'flour', 'maavu',
      'sugar', 'chini', 'sakkarai', 'panchasara',
      'salt', 'namak', 'uppu',
      'oil', 'tel', 'ennai', 'enna',
      'masala', 'spices',
      'dal', 'paruppu', 'parippu', 'pulses',
      'soap', 'detergent', 'paste', 'toothpaste', 'brush', 'toothbrush',
      'shampoo', 'toiletries',
      'stationery', 'school items', 'school saman', 'stationery saman',
      'pen', 'pencil', 'notebook', 'copy', 'eraser', 'sharpener', 'scale', 'marker',
      'veetu saman', 'ghar ka saman', 'house items', 'kitchen saman'
    ],

    Vegetables: [
      'vegetables', 'vegetable', 'veg', 'veggie', 'veggies', 'fresh veg', 'fresh vegetables',
      'green veg', 'greens', 'leafy vegetables', 'fresh produce', 'produce',
      'sabji', 'sabzi', 'sabhji', 'sabi', 'sabby', 'hari sabzi', 'fresh sabji', 'tarkari',
      'pachakari', 'pacha kari', 'pachkari', 'pachakkaari',
      'kaikari', 'kaykari', 'kai kari', 'kaai kari',
      'coriander', 'dhaniya', 'kothamalli', 'malli ila',
      'curry leaves', 'curry patta', 'kadi patta', 'kariveppila', 'karuveppilai',
      'mint', 'pudina',
      'spinach', 'keerai', 'cheera',
      'onion', 'pyaz', 'vengayam', 'savala',
      'tomato', 'tamatar', 'thakkali',
      'potato', 'aloo', 'urulai', 'urulakizhangu',
      'brinjal', 'baingan', 'kathirikai', 'vazhuthananga',
      'okra', 'bhindi', 'vendakkai', 'venda',
      'beans', 'carrot', 'cabbage', 'cauliflower', 'gobi', 'patta gobi',
      'beetroot', 'beet',
      'garlic', 'lahsun', 'poondu', 'veluthulli',
      'ginger', 'adrak', 'inji',
      'green chilli', 'green chili', 'mirchi', 'milagai', 'mulaku',
      'coconut',
      'drumstick', 'murungakkai',
      'cucumber', 'vellarikka',
      'kovakka', 'ivy gourd',
      'vegetable market', 'veg market'
    ],

    Snacks: [
      'snacks', 'snack', 'tea', 'chai', 'chaaya', 'chaya',
      'coffee', 'kaapi', 'kapi',
      'chips', 'chip', 'lays', 'kurkure',
      'biscuit', 'biscuits', 'biscut', 'biskit',
      'bakery', 'bakery item', 'bakery items',
      'bun', 'cake', 'pastry', 'puffs',
      'juice', 'fresh juice', 'cool drink', 'cool drinks', 'cooldrinks', 'soft drink', 'soft drinks',
      'tea snack', 'tea snacks', 'evening snack', 'evening snacks',
      'namkeen', 'mixture', 'sev', 'murukku',
      'vada', 'bajji', 'bonda', 'pakoda', 'pakora', 'pakkavada',
      'samosa', 'cutlet',
      'sweets', 'sweet', 'mithai', 'laddu', 'halwa',
      'ice cream', 'falooda', 'lassi', 'milk shake', 'shake',
      'chaat', 'panipuri', 'pani puri',
      'bakery snack', 'munching', 'munching items',
      'tea kadai snacks', 'evening tiffin'
    ],

    CSD: [
      'csd', 'c s d', 'canteen', 'military canteen', 'army canteen',
      'defence canteen', 'defense canteen', 'forces canteen',
      'ur canteen', 'unit run canteen', 'fauji canteen',
      'police canteen', 'navy canteen', 'airforce canteen',
      'canteen purchase', 'csd purchase'
    ],

    'Hotel Food': [
      'hotel food', 'restaurant', 'restaurant food',
      'outside food', 'eating out', 'dine out', 'dining out', 'outside eating',
      'parcel food', 'parcel', 'takeaway', 'take away', 'take-away',
      'food delivery', 'delivery food', 'ordered food', 'order food', 'home delivery',
      'swiggy', 'swiggi', 'zomato', 'zamato', 'zomatoo',
      'hotel saapadu', 'hotel kazhichu', 'hotel khana',
      'outside saapadu', 'outside kazhichu', 'bahar ka khana', 'bahar khaya',
      'dhaba', 'food court', 'fast food center',
      'resturant', 'restarant', 'restrant'
    ],

    Other: [
      'other', 'others', 'misc', 'miscellaneous', 'miscellanous',
      'general', 'general expense', 'other expense',
      'random', 'random expense', 'petty expense', 'petty cash',
      'small expense', 'sundry', 'sundries',
      'chilara', 'chillara', 'chillar', 'chillarai',
      'extra', 'unknown', 'undefined'
    ]
  },

  ledgerDirections: {
    given: [
      'gave', 'give', 'given', 'gave to',
      'lend', 'lent', 'loaned', 'loan to',
      'paid', 'paid to', 'sent', 'sent to', 'transfer', 'transferred', 'transferred to',
      'handed to', 'handed over',
      'diya', 'de diya', 'ko diya', 'diye', 'pay kiya', 'bheja', 'bhej diya',
      'koduthu', 'koduthen', 'kodutha', 'kuduthu', 'kuduthen',
      'anuppi', 'ayachu', 'thanna',
      'gpay kiya', 'gpay pannen', 'pay pannen', 'send pannen', 'send cheythu'
    ],

    received: [
      'received', 'receive', 'received from', 'got', 'got from', 'received money',
      'taken', 'taken from', 'collected', 'collected from',
      'credited', 'cash came', 'came in',
      'liya', 'se liya', 'mila', 'mil gaya', 'paise mile',
      'vangi', 'vanginen', 'vangitten', 'vangiyachu',
      'kitti', 'kittichu', 'kedaichithu', 'kidaichathu',
      'vanthuchu', 'vanthathu', 'aayi', 'kitti aayi',
      'gave me', 'given to me', 'gave to me'
    ],

    borrowed: [
      'borrowed', 'borrow', 'borrowed from',
      'took from', 'taken from', 'took money from', 'took cash from',
      'loan liya', 'udhar liya', 'udhar le liya', 'borrow kiya', 'maang liya',
      'kadan', 'appu', 'debt',
      'kadan vangi', 'kadan vanginen', 'kadana vaangi',
      'kadan eduthu', 'eduthu'
    ],

    owesMe: [
      'owes me', 'owe me',
      'pay me back', 'give me back', 'return me', 'return my money',
      'has to pay', 'has to give me', 'should give me', 'must give me', 'need to get',
      'due', 'dues from', 'pending from', 'balance from',
      'dena hai', 'wapas de', 'wapas karo', 'mera paisa dena hai',
      'tharanam', 'tharanu', 'tharanum', 'tharandi irukku',
      'kodukkanum', 'kodukka vendi irukku', 'baaki hai', 'baaki undu'
    ]
  },

  plannerDateWords: {
    today: [
      'today', 'tday', 'tod',
      'aaj',
      'inniku', 'inikku', 'iniku', 'innaiku', 'indru',
      'innu'
    ],

    tomorrow: [
      'tomorrow', 'tmrw', 'tom', 'tmorow', 'tommorrow', 'tomorow',
      'kal',
      'nalaiku', 'naalaiku', 'naalaikku', 'nalaikku',
      'naale', 'nale', 'nalekku'
    ],

    dayAfterTomorrow: [
      'day after tomorrow', 'day after', 'dayafter', 'two days later',
      'parson', 'parso',
      'marunaal', 'marunal', 'mattannaal', 'matanal',
      'naalandiku', 'naalaaniku'
    ]
  },

  plannerTimeWords: {
    morning: [
      'morning', 'morn', 'mrng', 'early morning', 'morning time', 'am',
      'subah', 'subhe', 'savere', 'subha',
      'kaalai', 'kalai', 'kaalaila', 'kalaila',
      'ravile', 'raavile', 'ravil', 'pularchakku'
    ],

    afternoon: [
      'afternoon', 'after noon', 'aft', 'aftrn', 'noon', 'midday', 'lunch time', 'pm',
      'dopahar', 'dopaher', 'duphar',
      'madhiyam', 'madiyam', 'madhyanam',
      'uchakku', 'uchaikku',
      'uchaykku', 'uchekku', 'pakalil'
    ],

    evening: [
      'evening', 'eve', 'evng', 'dusk', 'evening time',
      'shaam', 'sham', 'shyam', 'sandhya', 'sayankalam', 'sayantharam',
      'maalai', 'malai', 'maalai neram',
      'vaikunneram', 'vaikkunneram', 'vaikittu', 'vaigittu'
    ],

    night: [
      'night', 'tonight', 'night time', 'late night', 'nite', 'nyt',
      'raat', 'raath', 'aaj raat',
      'iravu', 'iravil', 'innu iravu', 'inniku night',
      'raathri', 'raatri', 'rathiri', 'rathri', 'rathrikku', 'rathriyil',
      'innu raathri', 'innu rathri', 'nightu'
    ]
  },

  taskVerbs: [
    'call', 'pay', 'buy', 'meeting', 'meet', 'appointment',
    'remind', 'reminder', 'doctor', 'medicine',
    'send', 'collect', 'visit', 'check',
    'schedule', 'book', 'pickup', 'pick up', 'drop',
    'message', 'whatsapp', 'submit', 'renew', 'repair', 'service',
    'get', 'bring', 'transfer', 'fix', 'cancel', 'finish', 'complete', 'start',
    'email', 'text', 'watch', 'clean', 'wash',
    'recharge', 'order', 'return', 'take', 'ask', 'tell',
    'fetch', 'purchase', 'attend', 'join', 'review', 'study', 'exam',
    'gym', 'workout', 'exercise', 'travel', 'go', 'reach'
  ],

  plannerJoiners: [
    'karna', 'karna hai', 'karo', 'kar lo',
    'need to', 'have to', 'want to', 'gotta', 'must', 'should',
    'remind me', 'remind me to', 'reminder for', 'set reminder', "don't forget to",
    'pannanum', 'pannum', 'pannu', 'seyyanum', 'seiyanum',
    'cheyyanam', 'cheyyu', 'venam',
    'vendi irukku', 'chaiye', 'to do', 'todo', 'irukku'
  ],

  localMixedVariants: {
    food: [
      'khana', 'saapadu', 'sapadu', 'sappadu', 'choru', 'oonu', 'bhojanam', 'oota',
      'meal', 'meals', 'breakfast', 'lunch', 'dinner', 'tiffin'
    ],

    'current bill': [
      'eb bill', 'eb', 'bijli bill', 'light bill', 'power bill',
      'kseb bill', 'tneb bill', 'bescom bill', 'current charge', 'meter bill'
    ],

    'mobile recharge': [
      're charge', 'topup', 'top up', 'phone recharge', 'sim recharge',
      'data pack', 'net pack', 'jio recharge', 'airtel recharge', 'phone bill'
    ],

    'hotel food': [
      'restaurant', 'outside food', 'parcel', 'takeaway', 'food delivery',
      'swiggy', 'zomato', 'hotel saapadu', 'hotel khana', 'bahar ka khana'
    ],

    groceries: [
      'ration', 'kirana', 'maligai', 'palacharakku', 'provisions',
      'veetu saman', 'ghar ka saman', 'monthly items', 'household items',
      'milk', 'curd', 'rice', 'atta', 'dal'
    ],

    vegetables: [
      'sabji', 'sabzi', 'sabhji', 'tarkari',
      'kaikari', 'kaykari', 'pachakari', 'pacha kari',
      'veg', 'veggies', 'greens', 'fresh produce',
      'dhaniya', 'kariveppila', 'karuveppilai'
    ],

    snacks: [
      'tea', 'chai', 'chaaya', 'coffee', 'kaapi',
      'chips', 'biscuit', 'biscuits', 'bakery items', 'puffs',
      'namkeen', 'samosa', 'bajji', 'bonda', 'juice', 'cool drinks'
    ],

    petrol: [
      'fuel', 'diesel', 'bunk', 'pump', 'petro', 'petral',
      'tank full', 'petrol adichu', 'petrol potu'
    ],

    smoke: [
      'sutta', 'beedi', 'bidi', 'cigarette', 'ciggy', 'cig',
      'sigaret', 'puffs'
    ],

    liquor: [
      'daaru', 'sharab', 'sarakku', 'kallu', 'beer', 'drinks',
      'bevco', 'tasmac', 'quarter', 'booze'
    ],

    gave: [
      'diya', 'de diya', 'koduthu', 'kodutha', 'kuduthu',
      'paid', 'lent', 'sent', 'pay pannen'
    ],

    received: [
      'liya', 'mila', 'vangi', 'vanginen', 'kitti', 'got',
      'credited', 'vanthuchu'
    ],

    borrowed: [
      'udhar', 'kadan', 'appu', 'loan', 'kadan vangi', 'eduthu', 'borrow kiya'
    ],

    owesMe: [
      'dena hai', 'tharanam', 'tharanu', 'baaki hai', 'pay me back', 'due', 'kodukkanum'
    ],

    today: [
      'aaj', 'inniku', 'inikku', 'iniku', 'indru', 'innu', 'tday'
    ],

    tomorrow: [
      'kal', 'nalaiku', 'naalaiku', 'naale', 'nale', 'nalekku', 'tmrw', 'tom'
    ],

    morning: [
      'subah', 'kaalai', 'kalai', 'ravile', 'raavile', 'mrng', 'am', 'pularchakku'
    ],

    afternoon: [
      'dopahar', 'madhiyam', 'uchakku', 'uchaykku', 'noon', 'pm', 'aft'
    ],

    evening: [
      'shaam', 'sham', 'maalai', 'vaikunneram', 'eve', 'evng', 'sayankalam'
    ],

    night: [
      'raat', 'iravu', 'raathri', 'raatri', 'nite', 'nyt', 'rathiri'
    ]
  },

  expenseNotePlaceWords: {
    placeIndicators: [
      'at', 'from', 'in', 'near', 'opposite', 'beside', 'by',
      'from shop', 'from hotel',
      'shop la', 'kadai la', 'hotel la', 'store la', 'bunk la',
      'se', 'ke paas', 'ke yahan',
      'la', 'il', 'ninnu', 'kitte', 'kitta',
      'pakkathula', 'ulla', 'kadayil', 'hotelil', 'shopil', 'bunkil'
    ],

    shopWords: [
      'shop', 'store', 'stores', 'mart', 'supermarket', 'hypermarket',
      'market', 'general store', 'provision store', 'kirana store',
      'maligai kadai', 'kadai', 'potti kadai', 'petty shop', 'petty kadai',
      'tea shop', 'juice shop', 'bakery shop', 'stationery shop',
      'medical shop', 'medicals', 'pharmacy', 'chemist',
      'vegetable shop', 'fruit shop', 'fancy store', 'corner shop',
      'bazaar', 'super market'
    ],

    hotelWords: [
      'hotel', 'restaurant', 'mess', 'bhavan', 'cafe', 'coffee house',
      'tea stall', 'tea kadai', 'bakery', 'fast food', 'dhaba',
      'military hotel', 'food court', 'eatery', 'canteen',
      'thattu kada', 'thattukada', 'thattu kadai', 'thatu kada', 'thatu kadai',
      'kaiyendhi bhavan', 'darshini', 'upahar', 'sagar', 'vihar'
    ],

    vendorWords: [
      'vendor', 'anna shop', 'chettan kada', 'ikka shop', 'chechi shop',
      'uncle shop', 'tea point', 'juice point',
      'canteen', 'csd canteen',
      'reliance fresh', 'dmart', 'big bazaar', 'nilgiris', 'more store', 'heritage',
      'local market', 'roadside shop',
      'thela', 'bandi', 'stall', 'cart', 'thallu vandi', 'vandi'
    ],

    marketWords: [
      'market', 'market area', 'mandi', 'bazaar',
      'vegetable market', 'fruit market', 'fish market',
      'weekly market', 'sunday market',
      'chantha', 'sandhai', 'meen chantha', 'uzhavar sandhai', 'rythu bazaar',
      'wholesale market', 'chanda'
    ]
  },

  numberWords: {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
    hundred: 100,
    thousand: 1000,
    lakh: 100000,
    lac: 100000
  }
}