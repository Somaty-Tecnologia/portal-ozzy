"""Gera src/lib/fichasProntas.json: fichas prontas da comida da equipe (Heitor, 14/10).

Uso: python3 -I scripts/gerar_fichas_refeicao.py > src/lib/fichasProntas.json

Quem cozinha não sabe o nome de cada material no cadastro. As fichas já vêm ligadas ao material pelo código da
Eclética (o mesmo do cadastro de materiais), com a quantidade POR PESSOA na unidade do material. Ele escolhe a
ficha, o portal multiplica pelas pessoas do dia e ele só ajusta e pesa o que ficou pronto.

Materiais vendidos por unidade ou pacote usam um tamanho suposto (ver TAMANHOS). Ficha com material que ainda não
está no cadastro (codigo None) aparece com o aviso "falta cadastrar".
"""
import json
import sys

# código, nome no cadastro, unidade do material
M = {
    'arroz': ('100015', 'Arroz Cru', 'kg'),
    'feijao': ('100042', 'Feijão Carioca', 'kg'),
    'macarrao': ('100055', 'Macarrão', 'un'),  # pacote de 500 g
    'lasanha': ('100257', 'Massa de Lasanha', 'kg'),
    'oleo': ('100063', 'Óleo de Soja', 'kg'),
    'azeite': ('100173', 'Azeite', 'l'),
    'manteiga': ('100184', 'Manteiga', 'kg'),
    'sal': ('100082', 'Sal Refinado', 'kg'),
    'acucar': ('100009', 'Açúcar Refinado', 'kg'),
    'alho': ('100013', 'Alho picado', 'kg'),
    'cebola': ('100028', 'Cebola', 'kg'),
    'cebola_roxa': ('100339', 'Cebola Roxa', 'kg'),
    'tomate': ('100086', 'Tomate Carmen', 'kg'),
    'tomate_cereja': ('100201', 'Tomate Cereja', 'kg'),
    'pimentao': ('100374', 'Pimentão', 'kg'),
    'pimentao_verm': ('100197', 'Pimentão Vermelho', 'kg'),
    'cenoura': ('100031', 'Cenoura', 'kg'),
    'batata': ('100019', 'Batata Inglesa', 'kg'),
    'batata_frita': ('100020', 'Batata Frita Congelada Surecrispy 7x7', 'kg'),
    'mandioquinha': ('100534', 'Mandioquinha', 'kg'),
    'chuchu': ('100176', 'Chuchu', 'kg'),
    'abobrinha': ('100171', 'Abobrinha Italiana', 'kg'),
    'berinjela': ('100271', 'Berinjela', 'kg'),
    'beterraba': ('100535', 'Beterraba', 'kg'),
    'couve': ('100178', 'Couve', 'kg'),
    'couve_flor': ('100293', 'Couve flor', 'un'),  # cabeça de ~1 kg
    'repolho': ('100270', 'Repolho verde', 'un'),  # cabeça de ~1,5 kg
    'repolho_roxo': ('100485', 'Repolho roxo', 'un'),
    'alface': ('100408', 'Alface Lisa', 'un'),  # pé serve ~8
    'alface_am': ('100010', 'Alface americana', 'un'),  # pé serve ~10
    'rucula': ('100079', 'Rúcula', 'un'),  # maço serve ~8
    'agriao': ('100409', 'Agrião', 'un'),  # maço serve ~8
    'pepino': ('100259', 'Pepino Japonês', 'kg'),
    'cogumelo': ('100528', 'Cogumelo Paris', 'kg'),
    'limao': ('100052', 'Limão Tahiti', 'kg'),
    'laranja': ('354', 'Laranja', 'kg'),
    'maca': ('100329', 'Maçã', 'kg'),
    'banana': ('100258', 'Banana Nanica', 'un'),
    'salsa': ('100083', 'Salsa Fresca (Cheiro verde)', 'kg'),
    'cebolinha': ('100238', 'Cebolinha', 'kg'),
    'coentro': ('100177', 'Coentro', 'kg'),
    'manjericao': ('100056', 'Manjericão', 'un'),  # maço
    'ervilha': ('100037', 'Ervilha', 'un'),  # pacote de 2 kg
    'milho': ('100059', 'Milho verde', 'un'),  # pacote de 2 kg
    'polpa': ('100076', 'Polpa de tomate', 'kg'),
    'extrato': ('100609', 'Extrato de tomate', 'kg'),
    'creme_leite': ('100036', 'Creme de Leite 0.2ml', 'kg'),
    'leite': ('100051', 'Leite Integral', 'l'),
    'mussarela': ('100078', 'Queijo Mussarela', 'kg'),
    'queijo_ralado': ('100372', 'Queijo Ralado', 'kg'),
    'catupiry': ('100027', 'Catupiry', 'kg'),
    'coalho': ('100251', 'Queijo Coalho', 'kg'),
    'iogurte': ('100578', 'Iogurte', 'kg'),
    'presunto': ('100077', 'Presunto', 'kg'),
    'bacon': ('100502', 'Bacon em cubos', 'kg'),
    'ovo': ('100064', 'Ovo Branco Extra', 'un'),
    'farinha': ('100040', 'Farinha de Trigo', 'kg'),
    'farinha_rosca': ('100470', 'Farinha de rosca', 'kg'),
    'panko': ('100041', 'Farinha Panko', 'kg'),
    'amido': ('100490', 'Amido de Milho', 'kg'),
    'fermento': ('100456', 'Fermento Químico', 'kg'),
    'pure_inst': ('100510', 'Purê de Batatas saquinho 800g', 'un'),
    'batata_palha': ('100021', 'Batata palha', 'un'),  # pacote de 800 g
    'shoyu': ('100084', 'Shoyu', 'l'),
    'vinagre': ('100088', 'Vinagre Branco', 'l'),
    'ketchup': ('100050', 'Ketchup galão Cepera 3.5kg', 'kg'),
    'mostarda': ('100060', 'Mostarda Galão Cepera 3.3kg', 'kg'),
    'maionese': ('100413', 'MAIONESE BASE', 'kg'),
    'barbecue': ('100018', 'Barbecue', 'kg'),
    'mel': ('100058', 'Mel Isis 1kg', 'kg'),
    'caldo': ('100025', 'Caldo de galinha', 'kg'),
    'louro': ('100045', 'Folha de Louro', 'kg'),
    'oregano': ('100375', 'Oregano', 'un'),  # pacote de 50 g
    'pimenta': ('100073', 'Pimenta do Reino', 'kg'),
    'paprica': ('100069', 'Páprica Doce', 'kg'),
    'paprica_def': ('100068', 'Paprica Defumada', 'kg'),
    'calabresa_pimenta': ('100194', 'Pimenta Calabresa', 'kg'),
    'gergelim': ('100128', 'Gergelim', 'kg'),
    'alho_po': ('100012', 'Alho em pó', 'kg'),
    'azeitona': ('100289', 'Azeitona preta', 'kg'),
    'gengibre_po': ('100451', 'Gengibre em pó', 'kg'),
    'pao_forma': ('100066', 'Pão de forma', 'un'),  # pacote
    'pao_hotdog': ('100500', 'Pão de Hot Dog', 'un'),
    'polenta': ('100607', 'Polenta frita', 'kg'),
    # proteínas
    'peito': ('100043', 'Peito de Frango', 'kg'),
    'sobrecoxa': ('100551', 'Sobrecoxa de frango desossada e sem pele', 'kg'),
    'asinha': ('100627', 'Asinha de frango', 'kg'),
    'passarinho': ('100085', 'Frango a passarinho', 'kg'),
    'sassami': ('100182', 'Filé de sassami', 'kg'),
    'moida': ('100186', 'Miolo de acém moido', 'kg'),
    'alcatra': ('100467', 'Alcatra', 'kg'),
    'lagarto': ('100236', 'Carne de lagarto', 'kg'),
    'pescoco': ('100589', 'Pescoço s/ osso bovino', 'kg'),
    'carne_seca': ('100608', 'Carne seca bovina', 'kg'),
    'bisteca': ('100022', 'Bisteca Suína', 'kg'),
    'lombo': ('100356', 'Lombo Suíno Fatiado', 'kg'),
    'pernil': ('100611', 'Pernil suino', 'kg'),
    'costelinha': ('100345', 'Costelinha', 'kg'),
    'linguica': ('100053', 'Linguiça', 'kg'),
    'calabresa': ('100230', 'Calabresa linguiça', 'kg'),
    'salsicha': ('100298', 'Salsicha', 'kg'),
    'peixe': ('100373', 'Peixe Congelado', 'kg'),
    'atum': ('100428', 'Atum', 'kg'),
    # ainda não estão no cadastro (aparecem com aviso)
    'farinha_mandioca': (None, 'Farinha de mandioca', 'kg'),
    'mandioca': (None, 'Mandioca', 'kg'),
    'feijao_preto': (None, 'Feijão preto', 'kg'),
    'lentilha': (None, 'Lentilha', 'kg'),
    'grao_bico': (None, 'Grão-de-bico', 'kg'),
    'fuba': (None, 'Fubá', 'kg'),
    'quiabo': (None, 'Quiabo', 'kg'),
    'brocolis': (None, 'Brócolis', 'kg'),
    'curcuma': (None, 'Cúrcuma (açafrão-da-terra)', 'kg'),
}
TAMANHOS = 'Macarrão e Ervilha/Milho por pacote (500 g / 2 kg), Couve-flor ~1 kg, Repolho ~1,5 kg, alface/rúcula/agrião ~8 porções por pé ou maço, Batata palha 800 g, Orégano 50 g.'

fichas = []
nomes = set()


def add(nome, tipo, categoria, itens, modo):
    if nome.lower() in nomes:
        raise SystemExit(f'repetida: {nome}')
    nomes.add(nome.lower())
    out = []
    for k, q in itens:
        cod, nm, un = M[k]
        ja = next((x for x in out if x['nome'] == nm), None)
        if ja:
            ja['quantidade'] = round(ja['quantidade'] + q, 4)
        else:
            out.append({'codigo': cod, 'nome': nm, 'quantidade': round(q, 4), 'unidade': un})
    fichas.append({'nome': nome, 'tipo': tipo, 'categoria': categoria, 'itens': out, 'modo': modo})


BASE = [('alho', 0.003), ('sal', 0.002), ('oleo', 0.006), ('pimenta', 0.0003)]
REFOGADO = [('cebola', 0.025), ('alho', 0.003), ('oleo', 0.006), ('sal', 0.002)]

# ---------------------------------------------------------------- pratos de proteína
# chave, nome no prato, artigo ("o"/"a"), quanto cru por pessoa (kg), grupo, pedaço (bife/cubos/inteiro)
PROTEINAS = [
    ('peito', 'Frango', 0.18, 'Frango'),
    ('sobrecoxa', 'Sobrecoxa', 0.20, 'Frango'),
    ('sassami', 'Sassami', 0.18, 'Frango'),
    ('alcatra', 'Alcatra', 0.18, 'Carne bovina'),
    ('lagarto', 'Lagarto', 0.18, 'Carne bovina'),
    ('pescoco', 'Carne de pescoço', 0.20, 'Carne bovina'),
    ('lombo', 'Lombo', 0.18, 'Suínos'),
    ('pernil', 'Pernil', 0.20, 'Suínos'),
    ('bisteca', 'Bisteca', 0.22, 'Suínos'),
    ('peixe', 'Peixe', 0.18, 'Peixe'),
]


def prep(chave, q):
    return [(chave, q)]


PREPAROS = {
    'grelhado': ('{p} grelhado', lambda c, q: prep(c, q) + BASE + [('limao', 0.01)],
                 'Tempere com alho, sal, pimenta e limão (30 min). Grelhe na chapa bem quente com um fio de óleo, 4 a 5 min de cada lado, sem mexer antes de dourar.'),
    'acebolado': ('{p} acebolado', lambda c, q: prep(c, q) + BASE + [('cebola', 0.06)],
                  'Tempere e grelhe na chapa. Na mesma chapa doure a cebola em rodelas com um fio de óleo e uma pitada de sal e cubra a carne.'),
    'molho_tomate': ('{p} ao molho de tomate', lambda c, q: prep(c, q) + BASE + REFOGADO + [('polpa', 0.06), ('tomate', 0.03), ('salsa', 0.002), ('acucar', 0.001)],
                     'Doure a proteína temperada e reserve. Refogue cebola e alho, junte tomate picado e a polpa, uma pitada de açúcar e cozinhe 10 min. Volte a proteína ao molho e cozinhe até ficar macia. Finalize com salsa.'),
    'milanesa': ('{p} à milanesa', lambda c, q: prep(c, q) + [('sal', 0.002), ('alho', 0.002), ('farinha', 0.02), ('ovo', 0.5), ('farinha_rosca', 0.03), ('oleo', 0.03)],
                 'Bata em bifes finos, tempere com sal e alho. Passe na farinha de trigo, no ovo batido e na farinha de rosca. Frite em óleo quente ou asse a 200 °C virando na metade.'),
    'parmegiana': ('{p} à parmegiana', lambda c, q: prep(c, q) + [('sal', 0.002), ('alho', 0.002), ('farinha', 0.02), ('ovo', 0.5), ('farinha_rosca', 0.03), ('oleo', 0.03), ('polpa', 0.06), ('mussarela', 0.04), ('oregano', 0.01)],
                   'Empane como milanesa e frite ou asse. Numa assadeira, cubra cada bife com molho de tomate e mussarela, salpique orégano e leve ao forno a 200 °C até derreter.'),
    'xadrez': ('{p} xadrez', lambda c, q: prep(c, q) + [('pimentao', 0.03), ('pimentao_verm', 0.03), ('cebola', 0.03), ('shoyu', 0.015), ('amido', 0.004), ('oleo', 0.008), ('alho', 0.003), ('gengibre_po', 0.0003)],
               'Corte em cubos e doure em fogo alto, aos poucos. Junte cebola e pimentões em quadrados e salteie 2 min. Dissolva o amido no shoyu com um pouco de água, junte e mexa até engrossar.'),
    'strogonoff': ('Strogonoff de {pl}', lambda c, q: prep(c, q * 0.85) + REFOGADO + [('cogumelo', 0.02), ('polpa', 0.03), ('ketchup', 0.01), ('mostarda', 0.005), ('creme_leite', 0.06), ('batata_palha', 0.04)],
                   'Corte em tiras e doure. Junte cebola e alho, depois cogumelo, polpa de tomate, ketchup e mostarda. Desligue o fogo e misture o creme de leite. Sirva com batata palha.'),
    'ensopado': ('{p} ensopado com batata e cenoura', lambda c, q: prep(c, q) + REFOGADO + [('batata', 0.08), ('cenoura', 0.04), ('polpa', 0.03), ('louro', 0.0002), ('salsa', 0.002)],
                 'Doure a proteína em pedaços. Junte cebola, alho e louro, a polpa e água até cobrir. Cozinhe até amaciar, junte batata e cenoura em cubos e cozinhe até ficarem macias. Finalize com salsa.'),
    'pizzaiolo': ('{p} à pizzaiolo', lambda c, q: prep(c, q) + BASE + [('polpa', 0.05), ('tomate', 0.03), ('mussarela', 0.03), ('oregano', 0.01), ('azeitona', 0.005)],
                  'Grelhe os bifes temperados. Na assadeira, cubra com polpa, rodelas de tomate, mussarela, azeitona e orégano. Forno a 200 °C até gratinar.'),
    'legumes': ('{p} refogado com legumes', lambda c, q: prep(c, q * 0.9) + REFOGADO + [('cenoura', 0.04), ('abobrinha', 0.05), ('pimentao', 0.02), ('cebolinha', 0.002)],
                'Corte em cubos e doure em fogo alto. Junte cebola e alho, depois cenoura em rodelas finas e, por último, abobrinha e pimentão. Acerte o sal e finalize com cebolinha.'),
    'mostarda_mel': ('{p} ao molho de mostarda e mel', lambda c, q: prep(c, q) + BASE + [('mostarda', 0.015), ('mel', 0.01), ('creme_leite', 0.03)],
                     'Grelhe a proteína temperada. Na mesma panela, misture mostarda, mel e creme de leite em fogo baixo até encorpar e cubra.'),
    'barbecue': ('{p} ao barbecue', lambda c, q: prep(c, q) + BASE + [('barbecue', 0.03), ('paprica_def', 0.0005)],
                 'Tempere com sal, alho e páprica defumada. Asse coberto a 180 °C até macio, descubra, pincele o barbecue e volte ao forno até caramelizar.'),
    'assado_batata': ('{p} assado com batatas', lambda c, q: prep(c, q) + BASE + [('batata', 0.15), ('cebola', 0.03), ('paprica', 0.0008), ('azeite', 0.005)],
                      'Tempere com alho, sal, páprica e um fio de azeite. Coloque na assadeira com batatas em gomos e cebola. Cubra com papel-alumínio, asse a 200 °C por 40 min e descubra para dourar.'),
    'alho_oleo': ('{p} ao alho e óleo', lambda c, q: prep(c, q) + [('alho', 0.008), ('oleo', 0.01), ('sal', 0.002), ('salsa', 0.002)],
                  'Corte em cubos, tempere com sal e doure em fogo alto. Junte bastante alho, deixe dourar sem queimar e finalize com salsa.'),
    'creme_milho': ('{p} ao creme com milho', lambda c, q: prep(c, q * 0.9) + REFOGADO + [('milho', 0.012), ('creme_leite', 0.05), ('leite', 0.03)],
                    'Corte em cubos e doure. Junte cebola e alho, depois o milho e o leite. Desligue e misture o creme de leite.'),
    'shoyu': ('{p} ao shoyu com gergelim', lambda c, q: prep(c, q) + [('shoyu', 0.015), ('alho', 0.003), ('gengibre_po', 0.0003), ('acucar', 0.003), ('oleo', 0.006), ('gergelim', 0.002), ('cebolinha', 0.002)],
              'Marine em shoyu, alho, gengibre e açúcar (30 min). Doure em fogo alto até caramelizar e finalize com gergelim e cebolinha.'),
}
QUAIS = {
    'Frango': ['grelhado', 'acebolado', 'molho_tomate', 'milanesa', 'parmegiana', 'xadrez', 'strogonoff', 'ensopado', 'pizzaiolo', 'legumes', 'mostarda_mel', 'barbecue', 'assado_batata', 'alho_oleo', 'creme_milho', 'shoyu'],
    'Carne bovina': ['grelhado', 'acebolado', 'molho_tomate', 'milanesa', 'parmegiana', 'xadrez', 'strogonoff', 'ensopado', 'pizzaiolo', 'legumes', 'alho_oleo', 'shoyu'],
    'Suínos': ['grelhado', 'acebolado', 'molho_tomate', 'milanesa', 'mostarda_mel', 'barbecue', 'assado_batata', 'alho_oleo', 'shoyu', 'legumes'],
    'Peixe': ['grelhado', 'molho_tomate', 'milanesa', 'assado_batata', 'legumes'],
}
SO_BIFE = {'milanesa', 'parmegiana', 'pizzaiolo'}
NAO = {('pescoco', 'grelhado'), ('pescoco', 'acebolado'), ('pescoco', 'milanesa'), ('pescoco', 'parmegiana'), ('pescoco', 'pizzaiolo'),
       ('pescoco', 'xadrez'), ('pescoco', 'alho_oleo'), ('pescoco', 'shoyu'), ('pernil', 'milanesa'), ('pernil', 'grelhado'),
       ('bisteca', 'milanesa'), ('bisteca', 'shoyu'), ('bisteca', 'legumes'), ('sassami', 'assado_batata'), ('sassami', 'ensopado'),
       ('lagarto', 'xadrez'), ('pernil', 'shoyu'), ('lagarto', 'grelhado'), ('lagarto', 'acebolado'), ('lagarto', 'alho_oleo'), ('lagarto', 'shoyu')}
PLURAL = {'Frango': 'frango', 'Sobrecoxa': 'sobrecoxa', 'Sassami': 'sassami', 'Alcatra': 'carne', 'Lagarto': 'lagarto', 'Lombo': 'lombo', 'Peixe': 'peixe'}
FEM = {'Sobrecoxa', 'Alcatra', 'Bisteca', 'Carne de pescoço'}

for chave, nome, q, grupo in PROTEINAS:
    for p in QUAIS[grupo]:
        if (chave, p) in NAO:
            continue
        titulo, itens, modo = PREPAROS[p]
        if p == 'strogonoff':
            if nome not in PLURAL or (nome == 'Lagarto'):
                continue
            n = titulo.format(pl=PLURAL[nome])
        else:
            n = titulo.format(p=nome)
            if nome in FEM:
                n = n.replace('grelhado', 'grelhada').replace('acebolado', 'acebolada').replace('ensopado', 'ensopada').replace('refogado', 'refogada').replace('assado', 'assada')
        add(n, 'prato', grupo, itens(chave, q), modo)

# Lagarto e pescoço: carne de panela e assados.
add('Carne de panela com batata', 'prato', 'Carne bovina', [('pescoco', 0.2)] + REFOGADO + [('batata', 0.1), ('cenoura', 0.03), ('polpa', 0.03), ('louro', 0.0002), ('salsa', 0.002)],
    'Doure a carne em pedaços grandes, aos poucos. Junte cebola, alho, louro e polpa, cubra com água e cozinhe na pressão 40 min. Junte batata e cenoura e cozinhe mais 10 min sem pressão.')
add('Carne louca desfiada', 'prato', 'Carne bovina', [('lagarto', 0.18), ('cebola', 0.04), ('pimentao', 0.03), ('tomate', 0.03), ('alho', 0.003), ('oleo', 0.006), ('sal', 0.002), ('vinagre', 0.005), ('salsa', 0.002)],
    'Cozinhe o lagarto na pressão com sal e louro por 50 min e desfie. Refogue cebola, alho, pimentão e tomate em tiras, junte a carne, um pouco do caldo e o vinagre.')
add('Lagarto recheado assado', 'prato', 'Carne bovina', [('lagarto', 0.18), ('bacon', 0.015), ('calabresa', 0.015), ('cenoura', 0.02)] + BASE,
    'Fure o lagarto no sentido do comprimento e recheie com bacon, calabresa e cenoura em tiras. Tempere, sele inteiro e asse coberto a 180 °C por 1h30. Fatie fino e regue com o caldo.')
add('Rosbife de alcatra', 'prato', 'Carne bovina', [('alcatra', 0.18), ('sal', 0.002), ('pimenta', 0.0003), ('mostarda', 0.005), ('oleo', 0.004)],
    'Passe mostarda, sal e pimenta na peça. Sele todos os lados e asse a 220 °C por 20 a 25 min (ao ponto). Descanse 10 min e fatie fino.')
add('Picadinho de carne', 'prato', 'Carne bovina', [('alcatra', 0.16)] + REFOGADO + [('tomate', 0.03), ('cenoura', 0.03), ('batata', 0.05), ('salsa', 0.002)],
    'Corte a carne em cubos pequenos e doure aos poucos. Junte cebola, alho e tomate, cubra com água e cozinhe até amaciar. Junte cenoura e batata em cubos pequenos e cozinhe até o caldo encorpar.')
add('Carne de panela desfiada com mandioca', 'prato', 'Carne bovina', [('pescoco', 0.18), ('mandioca', 0.15)] + REFOGADO + [('louro', 0.0002), ('cebolinha', 0.002)],
    'Cozinhe a carne na pressão com cebola, alho e louro (40 min) e desfie. Cozinhe a mandioca à parte e junte ao caldo da carne. Finalize com cebolinha.')
add('Vaca atolada', 'prato', 'Carne bovina', [('pescoco', 0.18), ('mandioca', 0.18)] + REFOGADO + [('tomate', 0.03), ('pimentao', 0.02), ('cebolinha', 0.002), ('louro', 0.0002)],
    'Doure a carne em pedaços, junte cebola, alho, tomate e pimentão, cubra com água e cozinhe na pressão 40 min. Junte a mandioca em pedaços e cozinhe até desmanchar um pouco.')

# Carne moída
MOIDA = [
    ('Carne moída refogada', [], 'Refogue cebola e alho, junte a carne e mexa até soltar e dourar. Acerte o sal e finalize com cheiro-verde.'),
    ('Carne moída com batata', [('batata', 0.1), ('polpa', 0.02)], 'Doure a carne com cebola e alho, junte a polpa, a batata em cubos pequenos e um pouco de água. Cozinhe tampado até a batata ficar macia.'),
    ('Carne moída com legumes', [('cenoura', 0.04), ('chuchu', 0.05), ('pimentao', 0.02)], 'Doure a carne com cebola e alho, junte cenoura e chuchu em cubos pequenos e pimentão, tampe e cozinhe até os legumes amaciarem.'),
    ('Carne moída com abobrinha', [('abobrinha', 0.08), ('tomate', 0.03)], 'Doure a carne com cebola e alho, junte tomate e abobrinha em cubos e cozinhe 8 min, sem deixar a abobrinha desmanchar.'),
    ('Carne moída com quiabo', [('quiabo', 0.08)], 'Doure o quiabo em rodelas com óleo até parar de babar e reserve. Doure a carne com cebola e alho e misture o quiabo no fim.'),
    ('Carne moída com milho e ervilha', [('milho', 0.01), ('ervilha', 0.01), ('tomate', 0.03)], 'Doure a carne com cebola e alho, junte tomate, milho e ervilha e cozinhe 5 min.'),
    ('Molho à bolonhesa', [('polpa', 0.08), ('cenoura', 0.02), ('acucar', 0.001), ('louro', 0.0002)], 'Doure a carne com cebola, alho e cenoura ralada. Junte polpa, louro, uma pitada de açúcar e água e cozinhe em fogo baixo por 30 min.'),
    ('Almôndegas ao sugo', [('ovo', 0.3), ('farinha_rosca', 0.015), ('polpa', 0.08), ('salsa', 0.003), ('queijo_ralado', 0.005)], 'Misture a carne com ovo, farinha de rosca, queijo ralado, salsa, sal e alho. Faça bolinhas, asse a 200 °C por 15 min e termine de cozinhar no molho de tomate por 15 min.'),
    ('Bolo de carne', [('ovo', 0.3), ('farinha_rosca', 0.015), ('cenoura', 0.02), ('presunto', 0.015), ('mussarela', 0.015), ('ketchup', 0.01)], 'Misture a carne com ovo, farinha de rosca, cenoura ralada, sal e alho. Abra em retângulo, recheie com presunto e mussarela, enrole, pincele ketchup e asse a 180 °C por 45 min.'),
    ('Hambúrguer caseiro', [('ovo', 0.2), ('farinha_rosca', 0.01), ('cebola', 0.01)], 'Misture a carne com cebola ralada, ovo, farinha de rosca, sal e pimenta. Modele bifes e grelhe na chapa 4 min de cada lado.'),
    ('Kafta assada', [('cebola', 0.02), ('salsa', 0.004), ('coentro', 0.002), ('paprica', 0.0008)], 'Misture a carne com cebola ralada, salsa, coentro, páprica, sal e alho. Modele em espetos ou rolinhos e asse a 220 °C por 15 min.'),
    ('Escondidinho de carne moída', [('batata', 0.22), ('leite', 0.04), ('manteiga', 0.008), ('polpa', 0.03), ('mussarela', 0.03)], 'Faça um purê firme com a batata, leite e manteiga. Refogue a carne com cebola, alho e polpa. Na assadeira: carne, purê e mussarela. Forno a 200 °C até gratinar.'),
    ('Escondidinho de carne moída com mandioca', [('mandioca', 0.22), ('manteiga', 0.008), ('catupiry', 0.02), ('mussarela', 0.025)], 'Cozinhe a mandioca e amasse com manteiga e sal. Refogue a carne. Na assadeira: carne, catupiry, purê de mandioca e mussarela. Forno até gratinar.'),
    ('Torta de carne moída', [('farinha', 0.04), ('ovo', 0.4), ('leite', 0.05), ('oleo', 0.01), ('fermento', 0.001), ('queijo_ralado', 0.005), ('tomate', 0.02), ('milho', 0.006)], 'Bata no liquidificador ovos, leite, óleo, farinha e queijo ralado; junte o fermento. Refogue a carne com tomate e milho. Assadeira untada: metade da massa, recheio, resto da massa. Forno a 180 °C por 40 min.'),
    ('Panqueca de carne', [('farinha', 0.035), ('ovo', 0.4), ('leite', 0.08), ('polpa', 0.06), ('mussarela', 0.02)], 'Bata leite, ovos, farinha e sal e faça as panquecas finas. Recheie com a carne refogada, enrole, cubra com molho de tomate e mussarela e gratine.'),
    ('Pimentão recheado com carne', [('pimentao', 0.12), ('arroz', 0.02), ('polpa', 0.04), ('mussarela', 0.015)], 'Refogue a carne e misture com arroz já cozido. Recheie os pimentões sem sementes, cubra com polpa e mussarela e asse a 180 °C por 35 min.'),
    ('Abobrinha recheada com carne', [('abobrinha', 0.15), ('polpa', 0.03), ('queijo_ralado', 0.008)], 'Corte a abobrinha ao meio e tire o miolo. Refogue a carne com o miolo picado e a polpa. Recheie, polvilhe queijo ralado e asse a 200 °C por 20 min.'),
    ('Picadinho de carne moída com quiabo e angu', [('quiabo', 0.06), ('fuba', 0.04)], 'Doure o quiabo e reserve. Refogue a carne e misture o quiabo. Para o angu, cozinhe o fubá em água com sal mexendo sempre até desgrudar da panela.'),
]
for nome, extra, modo in MOIDA:
    add(nome, 'prato', 'Carne moída', [('moida', 0.15)] + REFOGADO + [('pimenta', 0.0003), ('salsa', 0.002)] + extra, modo)

# Frango: extras
add('Frango assado (sobrecoxa)', 'prato', 'Frango', [('sobrecoxa', 0.22), ('limao', 0.01), ('paprica', 0.001)] + BASE,
    'Tempere a sobrecoxa com alho, limão, sal e páprica de véspera. Asse a 200 °C, coberta por 30 min e descoberta por mais 20 min.')
add('Frango a passarinho', 'prato', 'Frango', [('passarinho', 0.3), ('alho', 0.01), ('limao', 0.01), ('sal', 0.003), ('farinha', 0.01), ('oleo', 0.04), ('salsa', 0.002)],
    'Tempere com alho, limão e sal. Passe na farinha, frite em óleo quente até dourar (ou asse a 220 °C). Finalize com alho frito e salsa.')
add('Asinha assada', 'prato', 'Frango', [('asinha', 0.3), ('limao', 0.01), ('paprica', 0.001)] + BASE,
    'Tempere as asinhas com alho, limão, sal e páprica. Asse a 220 °C em grade ou assadeira espaçada, virando na metade, por 40 min.')
add('Asinha ao barbecue', 'prato', 'Frango', [('asinha', 0.3), ('barbecue', 0.03), ('mel', 0.005)] + BASE,
    'Asse as asinhas temperadas a 220 °C por 30 min. Misture barbecue e mel, cubra as asinhas e volte ao forno por 10 min.')
add('Asinha ao alho', 'prato', 'Frango', [('asinha', 0.3), ('alho', 0.01), ('sal', 0.003), ('oleo', 0.008), ('salsa', 0.002)],
    'Tempere com sal e metade do alho e asse a 220 °C por 35 min. Doure o resto do alho no óleo e espalhe por cima com salsa.')
add('Asinha frita crocante', 'prato', 'Frango', [('asinha', 0.3), ('farinha', 0.015), ('amido', 0.01), ('paprica', 0.001), ('oleo', 0.04)] + [('sal', 0.003), ('alho', 0.003)],
    'Tempere as asinhas. Passe na mistura de farinha, amido e páprica e frite em óleo a 170 °C até dourar e cozinhar por dentro.')
add('Frango desfiado refogado', 'prato', 'Frango', [('peito', 0.16), ('tomate', 0.03), ('cebolinha', 0.002), ('salsa', 0.002)] + REFOGADO,
    'Cozinhe o peito na água com sal e louro e desfie. Refogue cebola, alho e tomate, junte o frango e um pouco do caldo. Finalize com cheiro-verde.')
add('Fricassê de frango', 'prato', 'Frango', [('peito', 0.15), ('milho', 0.012), ('creme_leite', 0.05), ('catupiry', 0.02), ('mussarela', 0.025), ('batata_palha', 0.03)] + REFOGADO,
    'Cozinhe e desfie o frango. Refogue com cebola e alho, junte milho, creme de leite e catupiry. Coloque na assadeira, cubra com mussarela, gratine e sirva com batata palha.')
add('Escondidinho de frango', 'prato', 'Frango', [('peito', 0.14), ('batata', 0.22), ('leite', 0.04), ('manteiga', 0.008), ('catupiry', 0.02), ('mussarela', 0.025), ('tomate', 0.02)] + REFOGADO,
    'Faça purê com batata, leite e manteiga. Refogue o frango desfiado com tomate. Na assadeira: frango, catupiry, purê e mussarela. Gratine a 200 °C.')
add('Torta de frango', 'prato', 'Frango', [('peito', 0.12), ('farinha', 0.04), ('ovo', 0.4), ('leite', 0.05), ('oleo', 0.012), ('fermento', 0.001), ('queijo_ralado', 0.005), ('milho', 0.006), ('tomate', 0.02)] + REFOGADO,
    'Bata ovos, leite, óleo, farinha e queijo ralado; junte o fermento. Refogue o frango desfiado com tomate e milho. Massa, recheio e massa. Forno a 180 °C por 40 min.')
add('Panqueca de frango', 'prato', 'Frango', [('peito', 0.12), ('farinha', 0.035), ('ovo', 0.4), ('leite', 0.08), ('polpa', 0.06), ('mussarela', 0.02), ('catupiry', 0.015)] + REFOGADO,
    'Faça as panquecas (leite, ovos, farinha, sal). Recheie com frango desfiado refogado e catupiry, enrole, cubra com molho e mussarela e gratine.')
add('Frango com quiabo', 'prato', 'Frango', [('sobrecoxa', 0.2), ('quiabo', 0.08), ('tomate', 0.03)] + REFOGADO,
    'Doure o quiabo em rodelas até parar de babar e reserve. Doure o frango em pedaços, refogue com cebola, alho e tomate, cozinhe com um pouco de água e junte o quiabo no fim.')
add('Galinhada', 'prato', 'Frango', [('sobrecoxa', 0.15), ('arroz', 0.07), ('curcuma', 0.0005), ('tomate', 0.02), ('pimentao', 0.015), ('ervilha', 0.006), ('milho', 0.006), ('salsa', 0.002)] + REFOGADO,
    'Doure o frango em pedaços. Junte cebola, alho, tomate, pimentão e cúrcuma. Junte o arroz, refogue e cubra com o dobro de água quente. Cozinhe tampado, junte milho, ervilha e salsa no fim.')
add('Risoto de frango', 'prato', 'Frango', [('peito', 0.12), ('arroz', 0.07), ('caldo', 0.002), ('creme_leite', 0.03), ('queijo_ralado', 0.01), ('manteiga', 0.005), ('milho', 0.006)] + REFOGADO,
    'Doure o frango em cubos e reserve. Refogue cebola e alho, junte o arroz e vá colocando caldo quente aos poucos, mexendo. Volte o frango e o milho, desligue e misture creme de leite, manteiga e queijo.')
add('Canja de galinha', 'prato', 'Frango', [('peito', 0.1), ('arroz', 0.03), ('cenoura', 0.03), ('batata', 0.04), ('caldo', 0.002), ('salsa', 0.002), ('cebolinha', 0.002)] + REFOGADO,
    'Cozinhe o frango em água com cebola e alho, desfie. No caldo, cozinhe arroz, cenoura e batata em cubos até o arroz abrir. Volte o frango e finalize com cheiro-verde.')
add('Salpicão de frango', 'prato', 'Frango', [('peito', 0.12), ('cenoura', 0.03), ('milho', 0.008), ('ervilha', 0.006), ('maionese', 0.03), ('creme_leite', 0.015), ('maca', 0.02), ('batata_palha', 0.03), ('salsa', 0.002), ('sal', 0.001)],
    'Cozinhe e desfie o frango. Misture com cenoura ralada, milho, ervilha, maçã em cubos, maionese e creme de leite. Acerte o sal e cubra com batata palha na hora de servir.')
add('Yakisoba de frango', 'prato', 'Frango', [('peito', 0.12), ('macarrao', 0.16), ('repolho', 0.04), ('cenoura', 0.03), ('pimentao', 0.02), ('cebola', 0.02), ('shoyu', 0.02), ('amido', 0.004), ('acucar', 0.002), ('oleo', 0.008), ('gengibre_po', 0.0003)],
    'Cozinhe o macarrão al dente. Doure o frango em tiras, junte cebola, cenoura, pimentão e repolho e salteie em fogo alto. Junte o molho (shoyu, açúcar, amido e água), o macarrão e misture.')
add('Frango empanado crocante (panko)', 'prato', 'Frango', [('sassami', 0.18), ('farinha', 0.015), ('ovo', 0.4), ('panko', 0.03), ('oleo', 0.03), ('sal', 0.002), ('alho', 0.002), ('paprica', 0.0008)],
    'Tempere os sassamis. Passe na farinha, no ovo e no panko. Asse a 210 °C em assadeira untada, virando na metade, ou frite.')
add('Coxinha de frango assada de travessa', 'prato', 'Frango', [('peito', 0.12), ('batata', 0.18), ('manteiga', 0.008), ('catupiry', 0.02), ('farinha_rosca', 0.01), ('ovo', 0.2)] + REFOGADO,
    'Faça um purê firme de batata com manteiga. Refogue o frango desfiado. Na travessa: purê, frango com catupiry, purê. Pincele ovo, polvilhe farinha de rosca e asse até dourar.')
add('Frango ao curry com cúrcuma', 'prato', 'Frango', [('sobrecoxa', 0.18), ('curcuma', 0.001), ('creme_leite', 0.04), ('gengibre_po', 0.0004), ('maca', 0.02)] + REFOGADO,
    'Doure o frango em cubos, junte cebola, alho, cúrcuma, gengibre e maçã picada. Cozinhe com um pouco de água e finalize com creme de leite.')

# Suínos e embutidos: extras
add('Costelinha suína assada', 'prato', 'Suínos', [('costelinha', 0.3), ('limao', 0.01), ('paprica', 0.001)] + BASE,
    'Tempere com alho, limão, sal e páprica. Asse coberta a 180 °C por 1h, descubra e asse mais 20 min a 220 °C para dourar.')
add('Costelinha ao barbecue', 'prato', 'Suínos', [('costelinha', 0.3), ('barbecue', 0.04), ('paprica_def', 0.0008)] + BASE,
    'Tempere e asse coberta a 180 °C por 1h. Pincele barbecue e asse descoberta a 220 °C por 15 min.')
add('Costelinha com mandioca', 'prato', 'Suínos', [('costelinha', 0.28), ('mandioca', 0.15), ('tomate', 0.02)] + REFOGADO,
    'Doure a costelinha em pedaços, junte cebola, alho e tomate e cozinhe na pressão 25 min. Junte a mandioca cozida e deixe pegar o caldo.')
add('Pernil assado', 'prato', 'Suínos', [('pernil', 0.2), ('limao', 0.01), ('cebola', 0.02), ('louro', 0.0002)] + BASE,
    'Tempere de véspera com alho, limão, cebola, louro e sal. Asse coberto a 180 °C por 2h e descoberto por mais 30 min.')
add('Pernil desfiado acebolado', 'prato', 'Suínos', [('pernil', 0.18), ('cebola', 0.05), ('vinagre', 0.005), ('salsa', 0.002)] + BASE,
    'Asse ou cozinhe o pernil na pressão até desmanchar e desfie. Refogue bastante cebola, junte o pernil, um pouco do caldo e o vinagre.')
add('Linguiça acebolada', 'prato', 'Embutidos', [('linguica', 0.16), ('cebola', 0.05), ('oleo', 0.003)],
    'Fure a linguiça e asse a 200 °C por 25 min ou frite em fogo médio. Doure a cebola em rodelas na mesma panela e misture.')
add('Linguiça assada com batatas', 'prato', 'Embutidos', [('linguica', 0.16), ('batata', 0.15), ('cebola', 0.03), ('azeite', 0.005), ('sal', 0.001), ('paprica', 0.0005)],
    'Na assadeira, coloque batatas em gomos temperadas com azeite, sal e páprica, a cebola e as linguiças. Asse a 200 °C por 40 min, virando na metade.')
add('Linguiça ao molho de tomate', 'prato', 'Embutidos', [('linguica', 0.15), ('polpa', 0.05), ('pimentao', 0.02)] + REFOGADO,
    'Doure a linguiça em pedaços, junte cebola, alho e pimentão, depois a polpa e um pouco de água. Cozinhe 15 min.')
add('Calabresa acebolada', 'prato', 'Embutidos', [('calabresa', 0.12), ('cebola', 0.06), ('oleo', 0.003)],
    'Corte a calabresa em rodelas e doure. Junte a cebola em rodelas e refogue até murchar.')
add('Calabresa com batata', 'prato', 'Embutidos', [('calabresa', 0.1), ('batata', 0.15), ('cebola', 0.03), ('pimentao', 0.02), ('oleo', 0.005), ('sal', 0.001), ('salsa', 0.002)],
    'Cozinhe a batata em cubos al dente. Doure a calabresa, junte cebola, pimentão e a batata e deixe dourar. Finalize com salsa.')
add('Salsicha ao molho', 'prato', 'Embutidos', [('salsicha', 0.15), ('polpa', 0.06), ('ketchup', 0.008), ('pimentao', 0.02)] + REFOGADO,
    'Corte a salsicha em rodelas. Refogue cebola, alho e pimentão, junte polpa, ketchup e um pouco de água e cozinhe a salsicha no molho por 10 min.')
add('Salsicha com purê', 'prato', 'Embutidos', [('salsicha', 0.15), ('batata', 0.2), ('leite', 0.04), ('manteiga', 0.008), ('polpa', 0.04)] + REFOGADO,
    'Faça o purê com batata, leite e manteiga. Cozinhe a salsicha no molho de tomate refogado e sirva por cima do purê.')
add('Cachorro-quente de panela', 'prato', 'Embutidos', [('salsicha', 0.12), ('pao_hotdog', 1), ('polpa', 0.05), ('milho', 0.006), ('ervilha', 0.006), ('batata_palha', 0.03), ('ketchup', 0.008), ('mostarda', 0.005)] + REFOGADO,
    'Faça o molho com cebola, alho, polpa, milho e ervilha e cozinhe a salsicha nele. Sirva com pão e batata palha.')

# Carne seca
add('Carne seca acebolada', 'prato', 'Carne bovina', [('carne_seca', 0.12), ('cebola', 0.06), ('oleo', 0.006), ('salsa', 0.002)],
    'Dessalgue a carne seca de véspera (troque a água 3 vezes), cozinhe na pressão 30 min e desfie. Refogue com bastante cebola.')
add('Escondidinho de carne seca', 'prato', 'Carne bovina', [('carne_seca', 0.1), ('mandioca', 0.2), ('manteiga', 0.01), ('catupiry', 0.02), ('mussarela', 0.025)] + REFOGADO,
    'Dessalgue, cozinhe e desfie a carne seca e refogue. Faça purê de mandioca com manteiga. Na assadeira: carne, catupiry, purê, mussarela. Gratine.')
add('Arroz carreteiro', 'prato', 'Carne bovina', [('carne_seca', 0.08), ('arroz', 0.07), ('bacon', 0.01), ('calabresa', 0.02), ('tomate', 0.02), ('cebolinha', 0.002)] + REFOGADO,
    'Dessalgue e desfie a carne seca. Doure bacon e calabresa, junte cebola, alho e a carne. Junte o arroz, refogue, cubra com água quente e cozinhe. Finalize com tomate e cebolinha.')

# Peixe e atum
add('Peixe assado com legumes', 'prato', 'Peixe', [('peixe', 0.18), ('batata', 0.08), ('tomate', 0.03), ('cebola', 0.03), ('pimentao', 0.02), ('azeite', 0.008), ('limao', 0.01), ('sal', 0.002), ('alho', 0.002)],
    'Tempere o peixe com limão, sal e alho. Na assadeira, faça camada de batata em rodelas finas, o peixe e por cima tomate, cebola e pimentão. Regue com azeite, cubra e asse a 200 °C por 30 min.')
add('Moqueca de peixe', 'prato', 'Peixe', [('peixe', 0.18), ('tomate', 0.05), ('cebola', 0.04), ('pimentao', 0.02), ('pimentao_verm', 0.02), ('coentro', 0.003), ('limao', 0.01), ('azeite', 0.008), ('sal', 0.002), ('alho', 0.002)],
    'Tempere o peixe com limão, sal e alho. Em panela larga, faça camadas de cebola, tomate e pimentões, o peixe e mais legumes por cima. Regue com azeite, tampe e cozinhe 20 min. Finalize com coentro.')
add('Peixe frito', 'prato', 'Peixe', [('peixe', 0.18), ('farinha', 0.02), ('amido', 0.006), ('oleo', 0.03), ('limao', 0.01), ('sal', 0.002), ('alho', 0.002)],
    'Tempere com limão, sal e alho. Passe na mistura de farinha e amido e frite em óleo quente até dourar.')
add('Peixe ao molho de tomate com creme', 'prato', 'Peixe', [('peixe', 0.18), ('tomate', 0.04), ('creme_leite', 0.04), ('coentro', 0.003), ('limao', 0.01)] + REFOGADO,
    'Grelhe o peixe temperado. Refogue cebola, alho e tomate, junte creme de leite e cozinhe 3 min. Cubra o peixe e finalize com coentro.')
add('Torta de atum', 'prato', 'Peixe', [('atum', 0.06), ('farinha', 0.04), ('ovo', 0.4), ('leite', 0.05), ('oleo', 0.012), ('fermento', 0.001), ('tomate', 0.02), ('milho', 0.006), ('azeitona', 0.005)] + REFOGADO,
    'Bata ovos, leite, óleo e farinha; junte fermento. Refogue o atum com tomate, milho e azeitona. Massa, recheio e massa. Forno a 180 °C por 40 min.')
add('Macarrão com atum', 'prato', 'Massas', [('atum', 0.06), ('macarrao', 0.2), ('polpa', 0.05), ('azeitona', 0.005), ('salsa', 0.002)] + REFOGADO,
    'Cozinhe o macarrão al dente. Refogue cebola e alho, junte atum, polpa e azeitona e cozinhe 5 min. Misture ao macarrão e finalize com salsa.')

# Ovos
OVOS = [
    ('Omelete de queijo e presunto', [('ovo', 3), ('presunto', 0.02), ('mussarela', 0.02), ('leite', 0.01), ('sal', 0.001), ('oleo', 0.004), ('cebolinha', 0.002)], 'Bata os ovos com leite e sal. Em frigideira untada, despeje, cubra com presunto e mussarela, dobre e deixe dourar.'),
    ('Omelete de legumes', [('ovo', 3), ('tomate', 0.02), ('cebola', 0.015), ('pimentao', 0.01), ('cenoura', 0.015), ('sal', 0.001), ('oleo', 0.004), ('salsa', 0.002)], 'Refogue os legumes picados, junte os ovos batidos com sal e cozinhe em fogo baixo tampado. Vire ou termine no forno.'),
    ('Omelete de forno', [('ovo', 3), ('leite', 0.02), ('tomate', 0.02), ('cebola', 0.01), ('mussarela', 0.02), ('presunto', 0.015), ('queijo_ralado', 0.005), ('sal', 0.001)], 'Bata ovos e leite, junte tomate, cebola, presunto e mussarela picados. Assadeira untada a 180 °C por 25 min.'),
    ('Ovos mexidos com tomate', [('ovo', 3), ('tomate', 0.03), ('cebola', 0.01), ('manteiga', 0.005), ('sal', 0.001), ('cebolinha', 0.002)], 'Refogue cebola e tomate na manteiga, junte os ovos batidos e mexa em fogo baixo até ficarem cremosos.'),
    ('Ovo frito', [('ovo', 2), ('oleo', 0.006), ('sal', 0.0005)], 'Frite em óleo quente, regando a gema com o óleo, até a clara firmar.'),
    ('Ovo cozido', [('ovo', 2), ('sal', 0.0003)], 'Coloque os ovos em água fervente por 10 min e passe para água fria.'),
    ('Fritada de batata (tortilha)', [('ovo', 3), ('batata', 0.12), ('cebola', 0.03), ('azeite', 0.008), ('sal', 0.0015)], 'Cozinhe a batata em rodelas finas com cebola no azeite até amaciar. Junte os ovos batidos com sal, cozinhe tampado em fogo baixo e termine no forno.'),
    ('Ovos ao molho de tomate', [('ovo', 2), ('polpa', 0.06), ('tomate', 0.02), ('cebola', 0.02), ('alho', 0.002), ('azeite', 0.005), ('sal', 0.001), ('salsa', 0.002)], 'Faça o molho com cebola, alho, tomate e polpa. Abra cavidades, quebre os ovos dentro, tampe e cozinhe até a clara firmar.'),
    ('Quiche de legumes de travessa', [('ovo', 2), ('farinha', 0.04), ('manteiga', 0.015), ('leite', 0.04), ('creme_leite', 0.03), ('abobrinha', 0.04), ('cenoura', 0.02), ('queijo_ralado', 0.008), ('sal', 0.0015)], 'Faça massa com farinha, manteiga e sal, forre a travessa e pré-asse 10 min. Recheie com os legumes refogados e a mistura de ovos, leite e creme de leite. Asse a 180 °C por 30 min.'),
]
for nome, itens, modo in OVOS:
    add(nome, 'prato', 'Ovos', itens, modo)

# Massas e pratos de forno
MASSAS = [
    ('Macarronada à bolonhesa', [('macarrao', 0.2), ('moida', 0.1), ('polpa', 0.08), ('queijo_ralado', 0.008), ('acucar', 0.001)] + REFOGADO, 'Faça o molho com a carne refogada, polpa e uma pitada de açúcar (30 min). Cozinhe o macarrão al dente, misture e sirva com queijo ralado.'),
    ('Macarrão ao sugo', [('macarrao', 0.2), ('polpa', 0.08), ('tomate', 0.03), ('manjericao', 0.02), ('azeite', 0.005), ('queijo_ralado', 0.008), ('acucar', 0.001)] + REFOGADO, 'Refogue cebola e alho no azeite, junte tomate e polpa e cozinhe 15 min. Misture ao macarrão al dente com manjericão.'),
    ('Macarrão ao molho branco com presunto', [('macarrao', 0.2), ('leite', 0.12), ('farinha', 0.008), ('manteiga', 0.008), ('presunto', 0.03), ('creme_leite', 0.02), ('queijo_ralado', 0.008), ('sal', 0.001)], 'Derreta a manteiga, junte a farinha e mexa 1 min, adicione o leite aos poucos até engrossar. Junte presunto e creme de leite e misture ao macarrão.'),
    ('Macarrão alho e óleo com frango', [('macarrao', 0.2), ('peito', 0.1), ('alho', 0.008), ('azeite', 0.01), ('salsa', 0.003), ('sal', 0.002), ('calabresa_pimenta', 0.0002)], 'Doure o frango em cubos. Doure bastante alho no azeite, junte o frango, o macarrão al dente e um pouco da água do cozimento. Finalize com salsa.'),
    ('Macarrão com calabresa', [('macarrao', 0.2), ('calabresa', 0.06), ('polpa', 0.06), ('pimentao', 0.02)] + REFOGADO, 'Doure a calabresa, junte cebola, alho e pimentão e depois a polpa. Cozinhe 10 min e misture ao macarrão.'),
    ('Macarrão com salsicha', [('macarrao', 0.2), ('salsicha', 0.08), ('polpa', 0.07), ('milho', 0.006)] + REFOGADO, 'Refogue a salsicha em rodelas com cebola e alho, junte polpa e milho e cozinhe 10 min. Misture ao macarrão.'),
    ('Macarrão à carbonara de bacon', [('macarrao', 0.2), ('bacon', 0.03), ('ovo', 1), ('queijo_ralado', 0.015), ('pimenta', 0.0005), ('sal', 0.001)], 'Doure o bacon. Bata ovos com queijo ralado e pimenta. Misture o macarrão quente com o bacon fora do fogo e junte os ovos mexendo rápido, com um pouco da água do cozimento.'),
    ('Macarrão ao forno', [('macarrao', 0.18), ('moida', 0.08), ('polpa', 0.07), ('presunto', 0.02), ('mussarela', 0.035), ('queijo_ralado', 0.006)] + REFOGADO, 'Misture o macarrão al dente com o molho de carne. Na assadeira: macarrão, presunto, mussarela e queijo ralado. Gratine a 200 °C.'),
    ('Macarrão com frango e creme de leite', [('macarrao', 0.2), ('peito', 0.1), ('creme_leite', 0.05), ('milho', 0.006), ('queijo_ralado', 0.006)] + REFOGADO, 'Doure o frango em cubos com cebola e alho, junte milho e creme de leite e misture ao macarrão.'),
    ('Macarrão com legumes', [('macarrao', 0.2), ('abobrinha', 0.05), ('cenoura', 0.03), ('tomate', 0.03), ('azeite', 0.008), ('queijo_ralado', 0.006)] + REFOGADO, 'Refogue cebola, alho, cenoura, abobrinha e tomate no azeite e misture ao macarrão.'),
    ('Lasanha à bolonhesa', [('lasanha', 0.07), ('moida', 0.1), ('polpa', 0.08), ('presunto', 0.03), ('mussarela', 0.05), ('leite', 0.08), ('farinha', 0.006), ('manteiga', 0.006), ('queijo_ralado', 0.006)] + REFOGADO, 'Faça o molho de carne e um molho branco (manteiga, farinha, leite). Monte camadas de molho, massa, presunto, mussarela e molho branco. Cubra com mussarela e queijo ralado e asse a 180 °C por 40 min.'),
    ('Lasanha de frango', [('lasanha', 0.07), ('peito', 0.1), ('polpa', 0.06), ('catupiry', 0.02), ('mussarela', 0.05), ('milho', 0.006)] + REFOGADO, 'Refogue o frango desfiado com polpa e milho. Monte camadas de massa, frango, catupiry e mussarela. Asse a 180 °C por 40 min.'),
    ('Lasanha de presunto e queijo', [('lasanha', 0.07), ('presunto', 0.05), ('mussarela', 0.06), ('polpa', 0.08), ('queijo_ralado', 0.006), ('oregano', 0.01)] + REFOGADO, 'Faça um molho de tomate simples. Monte camadas de molho, massa, presunto e mussarela. Asse a 180 °C por 35 min.'),
    ('Lasanha de berinjela', [('berinjela', 0.15), ('moida', 0.08), ('polpa', 0.08), ('mussarela', 0.04), ('queijo_ralado', 0.008)] + REFOGADO, 'Grelhe a berinjela em fatias. Faça o molho de carne. Monte camadas de berinjela, molho e mussarela e asse a 180 °C por 30 min.'),
    ('Nhoque de batata ao sugo', [('batata', 0.2), ('farinha', 0.05), ('ovo', 0.2), ('polpa', 0.08), ('queijo_ralado', 0.008), ('manteiga', 0.005)] + REFOGADO, 'Cozinhe e esprema a batata, junte ovo, sal e farinha até desgrudar das mãos. Faça rolinhos, corte e cozinhe em água fervente até subirem. Sirva com molho de tomate.'),
    ('Polenta mole com carne moída', [('fuba', 0.05), ('moida', 0.12), ('polpa', 0.06), ('queijo_ralado', 0.008), ('manteiga', 0.005)] + REFOGADO, 'Cozinhe o fubá em água com sal mexendo sempre por 30 min e finalize com manteiga. Sirva com o molho de carne e queijo ralado.'),
    ('Arroz de forno', [('arroz', 0.07), ('presunto', 0.02), ('mussarela', 0.03), ('milho', 0.006), ('ervilha', 0.006), ('creme_leite', 0.03), ('polpa', 0.03), ('queijo_ralado', 0.006)] + REFOGADO, 'Cozinhe o arroz. Misture com presunto, milho, ervilha, polpa e creme de leite. Coloque na assadeira, cubra com mussarela e queijo ralado e gratine.'),
    ('Arroz à grega com frango', [('arroz', 0.07), ('peito', 0.1), ('cenoura', 0.02), ('ervilha', 0.006), ('milho', 0.006), ('pimentao', 0.015)] + REFOGADO, 'Doure o frango em cubos e reserve. Refogue cebola e alho, junte o arroz e cozinhe. No fim, junte cenoura, ervilha, milho, pimentão e o frango.'),
    ('Baião de dois', [('arroz', 0.05), ('feijao', 0.04), ('carne_seca', 0.05), ('bacon', 0.01), ('coalho', 0.03), ('coentro', 0.003)] + REFOGADO, 'Cozinhe o feijão al dente. Doure bacon e carne seca dessalgada, junte cebola, alho, o arroz e o feijão com caldo. Cozinhe e finalize com queijo coalho em cubos e coentro.'),
    ('Arroz com linguiça', [('arroz', 0.07), ('linguica', 0.08), ('tomate', 0.02), ('cebolinha', 0.002)] + REFOGADO, 'Doure a linguiça em rodelas, junte cebola e alho, o arroz e refogue. Cubra com água quente e cozinhe. Finalize com tomate e cebolinha.'),
    ('Feijoada', [('feijao_preto', 0.07), ('costelinha', 0.06), ('linguica', 0.05), ('bacon', 0.02), ('carne_seca', 0.03), ('louro', 0.0003)] + REFOGADO, 'Dessalgue a carne seca. Cozinhe o feijão preto com as carnes e louro na pressão 40 min. Refogue cebola e alho no bacon, junte uma concha de feijão amassado, volte para a panela e apure.'),
    ('Feijão tropeiro', [('feijao', 0.05), ('farinha_mandioca', 0.03), ('bacon', 0.02), ('linguica', 0.04), ('ovo', 0.5), ('couve', 0.02), ('cebolinha', 0.002)] + REFOGADO, 'Cozinhe o feijão al dente e escorra. Doure bacon e linguiça, junte cebola, alho e os ovos mexidos. Junte o feijão e a farinha aos poucos. Finalize com couve e cebolinha.'),
    ('Virado à paulista', [('feijao', 0.06), ('farinha_mandioca', 0.03), ('bisteca', 0.18), ('linguica', 0.06), ('ovo', 1), ('couve', 0.04), ('bacon', 0.01)] + REFOGADO, 'Faça o tutu com feijão batido, refogado e engrossado com farinha. Sirva com bisteca e linguiça fritas, ovo frito e couve refogada.'),
    ('Hambúrguer com arroz e ovo (prato feito)', [('moida', 0.14), ('ovo', 1.2), ('farinha_rosca', 0.008), ('cebola', 0.01), ('sal', 0.002), ('oleo', 0.008)], 'Modele hambúrgueres com a carne, cebola ralada, um pouco de ovo, farinha de rosca e sal. Grelhe e sirva com ovo frito por cima.'),
    ('Misto quente de forno (pão de forma)', [('pao_forma', 0.12), ('presunto', 0.04), ('mussarela', 0.04), ('manteiga', 0.008)], 'Monte sanduíches com pão de forma, presunto e mussarela, passe manteiga por fora e asse a 200 °C em assadeira, virando na metade.'),
    ('Sopa de legumes com carne', [('pescoco', 0.1), ('batata', 0.08), ('cenoura', 0.04), ('chuchu', 0.04), ('abobrinha', 0.03), ('macarrao', 0.04), ('salsa', 0.002)] + REFOGADO, 'Cozinhe a carne em cubos na pressão com cebola e alho (25 min). Junte os legumes em cubos e o macarrão e cozinhe até macios.'),
    ('Sopa de feijão com macarrão', [('feijao', 0.05), ('macarrao', 0.05), ('bacon', 0.01), ('batata', 0.04), ('cenoura', 0.02)] + REFOGADO, 'Bata o feijão cozido com o caldo. Refogue bacon, cebola e alho, junte o feijão batido, batata e cenoura em cubos e o macarrão e cozinhe.'),
    ('Sopa de lentilha com calabresa', [('lentilha', 0.05), ('calabresa', 0.04), ('cenoura', 0.03), ('batata', 0.04)] + REFOGADO, 'Doure a calabresa, junte cebola e alho, a lentilha e água. Cozinhe 20 min, junte cenoura e batata e cozinhe até macias.'),
    ('Caldo verde', [('batata', 0.15), ('couve', 0.03), ('calabresa', 0.04), ('azeite', 0.005)] + REFOGADO, 'Cozinhe a batata com cebola e alho e bata. Volte ao fogo, junte calabresa dourada e couve cortada bem fina e cozinhe 3 min.'),
    ('Creme de mandioquinha com frango', [('mandioquinha', 0.15), ('peito', 0.08), ('creme_leite', 0.02), ('caldo', 0.001), ('cebolinha', 0.002)] + REFOGADO, 'Cozinhe a mandioquinha com cebola, alho e caldo e bata. Junte o frango desfiado e o creme de leite e finalize com cebolinha.'),
]
for nome, itens, modo in MASSAS:
    add(nome, 'prato', 'Massas e forno' if any(k in ('macarrao', 'lasanha') for k, _ in itens) else 'Pratos completos', itens, modo)

# ---------------------------------------------------------------- acompanhamentos
ARROZ = [
    ('Arroz branco', [], 'Refogue o alho no óleo, junte o arroz e o sal e mexa 1 minuto. Cubra com o dobro de água fervente e cozinhe tampado em fogo baixo até secar (cerca de 20 min).'),
    ('Arroz com cenoura', [('cenoura', 0.02)], 'Refogue alho e cenoura ralada, junte o arroz e cozinhe como arroz branco.'),
    ('Arroz à grega', [('cenoura', 0.015), ('ervilha', 0.006), ('milho', 0.006), ('pimentao', 0.01), ('pimentao_verm', 0.01)], 'Cozinhe como arroz branco. Refogue os legumes em cubinhos e misture no arroz pronto.'),
    ('Arroz com brócolis', [('brocolis', 0.04)], 'Refogue o alho, junte o brócolis picado, depois o arroz e cozinhe como arroz branco.'),
    ('Arroz com couve', [('couve', 0.02)], 'Cozinhe o arroz branco e misture couve cortada fina refogada no alho.'),
    ('Arroz com milho', [('milho', 0.01)], 'Cozinhe como arroz branco e junte o milho nos últimos 5 minutos.'),
    ('Arroz com ervilha', [('ervilha', 0.01)], 'Cozinhe como arroz branco e junte a ervilha nos últimos 5 minutos.'),
    ('Arroz temperado com cheiro-verde', [('salsa', 0.003), ('cebolinha', 0.002), ('cebola', 0.01)], 'Refogue cebola e alho, cozinhe o arroz e misture cheiro-verde picado no fim.'),
    ('Arroz com cebola dourada', [('cebola', 0.025)], 'Doure a cebola em fatias finas até ficar bem dourada. Cozinhe o arroz e misture metade da cebola; a outra metade vai por cima.'),
    ('Arroz com bacon', [('bacon', 0.01), ('cebolinha', 0.002)], 'Doure o bacon, junte alho e o arroz e cozinhe como arroz branco. Finalize com cebolinha.'),
    ('Arroz com legumes', [('cenoura', 0.015), ('abobrinha', 0.02), ('chuchu', 0.02)], 'Refogue os legumes em cubinhos, junte o arroz e cozinhe como arroz branco.'),
    ('Arroz colorido com pimentões', [('pimentao', 0.012), ('pimentao_verm', 0.012), ('cebola', 0.01)], 'Refogue cebola e pimentões em cubinhos, junte o arroz e cozinhe.'),
    ('Arroz com açafrão-da-terra', [('curcuma', 0.0005), ('cebola', 0.01)], 'Refogue cebola e alho com a cúrcuma, junte o arroz e cozinhe como arroz branco.'),
    ('Arroz com tomate', [('tomate', 0.025), ('cebola', 0.01)], 'Refogue cebola, alho e tomate picado sem pele, junte o arroz e cozinhe.'),
    ('Arroz com alho dourado', [('alho', 0.004)], 'Cozinhe o arroz branco. Doure alho laminado no óleo e espalhe por cima.'),
    ('Arroz cremoso com queijo', [('leite', 0.03), ('creme_leite', 0.02), ('mussarela', 0.02), ('queijo_ralado', 0.005)], 'Cozinhe o arroz branco. Misture leite, creme de leite e mussarela em fogo baixo até ficar cremoso e finalize com queijo ralado.'),
    ('Arroz com linguiça e couve (mexido)', [('linguica', 0.03), ('couve', 0.015)], 'Doure a linguiça picada e misture com arroz branco pronto e couve fina refogada.'),
]
for nome, extra, modo in ARROZ:
    add(nome, 'acompanhamento', 'Arroz', [('arroz', 0.08), ('oleo', 0.005), ('alho', 0.002), ('sal', 0.0012)] + extra, modo)

FEIJAO = [
    ('Feijão carioca', [('cebola', 0.01), ('bacon', 0.008), ('louro', 0.0002)], 'Deixe de molho na véspera. Cozinhe na pressão com louro por 25 min. Refogue bacon, cebola e alho, junte uma concha de feijão amassado, volte para a panela e acerte o sal.'),
    ('Feijão simples (sem carne)', [('cebola', 0.01), ('louro', 0.0002)], 'Cozinhe na pressão com louro por 25 min. Refogue cebola e alho no óleo, junte ao feijão e apure.'),
    ('Feijão com calabresa', [('cebola', 0.01), ('calabresa', 0.02), ('louro', 0.0002)], 'Cozinhe o feijão. Doure a calabresa em cubos com cebola e alho e junte ao feijão. Apure 10 min.'),
    ('Feijão com linguiça e bacon', [('cebola', 0.01), ('linguica', 0.02), ('bacon', 0.01)], 'Cozinhe o feijão. Doure bacon e linguiça, junte cebola e alho e misture ao feijão. Apure.'),
    ('Feijão com couve', [('cebola', 0.01), ('couve', 0.02), ('bacon', 0.006)], 'Cozinhe o feijão temperado. Junte a couve cortada fina nos últimos 3 minutos.'),
    ('Feijão com legumes', [('cebola', 0.01), ('cenoura', 0.02), ('chuchu', 0.02), ('batata', 0.02)], 'Cozinhe o feijão. Junte os legumes em cubos e cozinhe até macios.'),
    ('Caldo de feijão', [('cebola', 0.012), ('bacon', 0.01), ('salsa', 0.002), ('cebolinha', 0.002)], 'Bata o feijão cozido com o caldo. Refogue bacon, cebola e alho, junte o feijão batido e cozinhe até encorpar. Finalize com cheiro-verde.'),
    ('Feijão gordo (com costelinha)', [('cebola', 0.01), ('costelinha', 0.04), ('bacon', 0.008), ('louro', 0.0002)], 'Cozinhe o feijão com a costelinha na pressão 35 min. Refogue bacon, cebola e alho, junte e apure.'),
    ('Tutu de feijão', [('cebola', 0.01), ('farinha_mandioca', 0.02), ('bacon', 0.01)], 'Bata o feijão cozido. Refogue bacon, cebola e alho, junte o feijão e engrosse com a farinha aos poucos, mexendo.'),
]
for nome, extra, modo in FEIJAO:
    add(nome, 'acompanhamento', 'Feijão', [('feijao', 0.06), ('oleo', 0.003), ('alho', 0.002), ('sal', 0.001)] + extra, modo)
add('Feijão preto', 'acompanhamento', 'Feijão', [('feijao_preto', 0.06), ('cebola', 0.01), ('alho', 0.002), ('bacon', 0.008), ('louro', 0.0002), ('oleo', 0.003), ('sal', 0.001)],
    'Cozinhe na pressão com louro por 30 min. Refogue bacon, cebola e alho, junte uma concha de feijão amassado e apure.')
add('Lentilha refogada', 'acompanhamento', 'Feijão', [('lentilha', 0.05), ('cebola', 0.01), ('alho', 0.002), ('cenoura', 0.015), ('oleo', 0.003), ('sal', 0.001), ('louro', 0.0002)],
    'Cozinhe a lentilha com louro por 15 min sem desmanchar. Refogue cebola, alho e cenoura e misture.')
add('Grão-de-bico refogado', 'acompanhamento', 'Feijão', [('grao_bico', 0.05), ('cebola', 0.01), ('alho', 0.002), ('tomate', 0.02), ('azeite', 0.004), ('sal', 0.001), ('salsa', 0.002)],
    'Deixe de molho na véspera e cozinhe na pressão 20 min. Refogue cebola, alho e tomate no azeite, junte o grão e salsa.')

LEGUMES = [
    ('Purê de batata', [('batata', 0.2), ('leite', 0.04), ('manteiga', 0.008), ('sal', 0.0015)], 'Cozinhe a batata em água com sal, escorra e amasse quente. Junte manteiga e leite quente e mexa até ficar liso.', 'Batata e purês'),
    ('Purê de batata instantâneo', [('pure_inst', 0.03), ('leite', 0.05), ('manteiga', 0.006), ('sal', 0.0005)], 'Ferva água e leite com manteiga e sal, desligue e misture o purê em flocos até ficar liso.', 'Batata e purês'),
    ('Purê de mandioquinha', [('mandioquinha', 0.18), ('leite', 0.03), ('manteiga', 0.008), ('sal', 0.0015)], 'Cozinhe a mandioquinha, amasse quente e misture manteiga e leite.', 'Batata e purês'),
    ('Purê de mandioca', [('mandioca', 0.2), ('leite', 0.04), ('manteiga', 0.008), ('sal', 0.0015)], 'Cozinhe a mandioca até desmanchar, tire os fios, amasse e misture manteiga e leite.', 'Batata e purês'),
    ('Batata sauté', [('batata', 0.18), ('manteiga', 0.008), ('salsa', 0.003), ('sal', 0.0015)], 'Cozinhe a batata em cubos al dente. Salteie na manteiga até dourar e finalize com salsa.', 'Batata e purês'),
    ('Batata cozida com salsa', [('batata', 0.18), ('azeite', 0.005), ('salsa', 0.003), ('sal', 0.0015)], 'Cozinhe a batata em pedaços com sal, escorra e tempere com azeite e salsa.', 'Batata e purês'),
    ('Batata assada rústica', [('batata', 0.2), ('azeite', 0.008), ('alho', 0.002), ('paprica', 0.0008), ('sal', 0.0015)], 'Corte em gomos com casca, tempere com azeite, alho, páprica e sal e asse a 220 °C por 40 min, virando na metade.', 'Batata e purês'),
    ('Batata frita', [('batata_frita', 0.15), ('oleo', 0.02), ('sal', 0.001)], 'Frite a batata congelada em óleo a 180 °C até dourar, escorra e salgue.', 'Batata e purês'),
    ('Batata gratinada', [('batata', 0.18), ('creme_leite', 0.04), ('leite', 0.03), ('mussarela', 0.02), ('queijo_ralado', 0.006), ('sal', 0.0015)], 'Cozinhe a batata em rodelas al dente. Na travessa, alterne batata e creme (creme de leite, leite e sal). Cubra com queijos e gratine.', 'Batata e purês'),
    ('Batata ao murro', [('batata', 0.2), ('azeite', 0.01), ('alho', 0.004), ('sal', 0.0015)], 'Cozinhe a batata inteira com casca, amasse levemente com a mão e asse a 220 °C com azeite e alho até dourar.', 'Batata e purês'),
    ('Mandioca cozida na manteiga', [('mandioca', 0.2), ('manteiga', 0.008), ('sal', 0.0015)], 'Cozinhe a mandioca até amaciar e salteie na manteiga.', 'Batata e purês'),
    ('Mandioca frita', [('mandioca', 0.2), ('oleo', 0.02), ('sal', 0.0015)], 'Cozinhe a mandioca al dente, escorra bem, corte em palitos e frite até dourar.', 'Batata e purês'),
    ('Polenta frita', [('polenta', 0.12), ('oleo', 0.015), ('sal', 0.0005)], 'Frite a polenta em óleo quente até dourar ou asse a 220 °C em assadeira untada.', 'Batata e purês'),
    ('Mandioquinha sauté', [('mandioquinha', 0.15), ('manteiga', 0.006), ('salsa', 0.002), ('sal', 0.0012)], 'Cozinhe a mandioquinha em rodelas al dente e salteie na manteiga.', 'Batata e purês'),
    ('Abobrinha refogada', [('abobrinha', 0.12), ('cebola', 0.015), ('tomate', 0.02), ('alho', 0.002), ('oleo', 0.004), ('sal', 0.0012)], 'Refogue cebola e alho, junte abobrinha em cubos e tomate, tampe e cozinhe 5 min sem deixar desmanchar.', 'Legumes'),
    ('Abobrinha gratinada', [('abobrinha', 0.12), ('polpa', 0.03), ('mussarela', 0.02), ('queijo_ralado', 0.005), ('sal', 0.001), ('oregano', 0.006)], 'Corte a abobrinha em rodelas, tempere e coloque na travessa com polpa, mussarela, queijo ralado e orégano. Asse a 200 °C por 20 min.', 'Legumes'),
    ('Chuchu refogado', [('chuchu', 0.12), ('cebola', 0.015), ('alho', 0.002), ('oleo', 0.004), ('sal', 0.0012), ('salsa', 0.002)], 'Refogue cebola e alho, junte chuchu em cubos, tampe e cozinhe no próprio vapor até ficar macio.', 'Legumes'),
    ('Chuchu com cenoura', [('chuchu', 0.08), ('cenoura', 0.04), ('cebola', 0.012), ('alho', 0.002), ('oleo', 0.004), ('sal', 0.0012), ('salsa', 0.002)], 'Refogue cebola e alho, junte cenoura e chuchu em cubos e cozinhe tampado até amaciar.', 'Legumes'),
    ('Cenoura sauté', [('cenoura', 0.1), ('manteiga', 0.006), ('salsa', 0.002), ('sal', 0.001)], 'Cozinhe a cenoura em rodelas al dente e salteie na manteiga com salsa.', 'Legumes'),
    ('Berinjela refogada', [('berinjela', 0.12), ('cebola', 0.02), ('tomate', 0.03), ('pimentao', 0.015), ('azeite', 0.008), ('alho', 0.002), ('sal', 0.0012), ('oregano', 0.006)], 'Refogue cebola e alho no azeite, junte berinjela em cubos, pimentão e tomate e cozinhe tampado 10 min.', 'Legumes'),
    ('Berinjela à parmegiana', [('berinjela', 0.13), ('farinha', 0.015), ('ovo', 0.4), ('farinha_rosca', 0.025), ('oleo', 0.02), ('polpa', 0.05), ('mussarela', 0.035), ('sal', 0.001)], 'Empane as fatias de berinjela e asse. Na travessa, alterne molho, berinjela e mussarela e gratine.', 'Legumes'),
    ('Couve refogada', [('couve', 0.05), ('alho', 0.003), ('oleo', 0.004), ('sal', 0.0008)], 'Corte a couve bem fina. Doure o alho e salteie a couve em fogo alto por 1 a 2 min.', 'Legumes'),
    ('Couve-flor gratinada', [('couve_flor', 0.12), ('leite', 0.06), ('farinha', 0.005), ('manteiga', 0.005), ('mussarela', 0.02), ('queijo_ralado', 0.005), ('sal', 0.001)], 'Cozinhe a couve-flor al dente. Faça molho branco, cubra, junte mussarela e queijo ralado e gratine.', 'Legumes'),
    ('Couve-flor empanada', [('couve_flor', 0.12), ('farinha', 0.015), ('ovo', 0.3), ('farinha_rosca', 0.02), ('oleo', 0.02), ('sal', 0.001)], 'Cozinhe os buquês al dente, empane e asse a 210 °C ou frite.', 'Legumes'),
    ('Repolho refogado', [('repolho', 0.08), ('cebola', 0.012), ('alho', 0.002), ('oleo', 0.004), ('sal', 0.001)], 'Refogue cebola e alho, junte o repolho em tiras finas e cozinhe 3 a 4 min mexendo, ainda crocante.', 'Legumes'),
    ('Repolho com bacon', [('repolho', 0.08), ('bacon', 0.012), ('cebola', 0.012), ('sal', 0.0008)], 'Doure o bacon, junte cebola e o repolho em tiras e refogue até murchar.', 'Legumes'),
    ('Legumes no vapor', [('cenoura', 0.04), ('chuchu', 0.04), ('abobrinha', 0.04), ('couve_flor', 0.04), ('azeite', 0.005), ('sal', 0.001)], 'Cozinhe os legumes no vapor (ou pouca água) até ficarem al dente e tempere com azeite e sal.', 'Legumes'),
    ('Legumes assados', [('cenoura', 0.04), ('abobrinha', 0.05), ('berinjela', 0.04), ('cebola_roxa', 0.02), ('pimentao', 0.02), ('azeite', 0.008), ('sal', 0.0012), ('alho', 0.002)], 'Corte em pedaços grandes, tempere com azeite, alho e sal e asse a 220 °C por 30 min.', 'Legumes'),
    ('Ratatouille', [('abobrinha', 0.05), ('berinjela', 0.05), ('tomate', 0.04), ('pimentao', 0.02), ('cebola', 0.02), ('polpa', 0.02), ('azeite', 0.008), ('alho', 0.002), ('sal', 0.0012)], 'Refogue cebola e alho no azeite, junte pimentão, berinjela, abobrinha, tomate e polpa e cozinhe em fogo baixo 20 min.', 'Legumes'),
    ('Jardineira de legumes', [('cenoura', 0.04), ('batata', 0.05), ('chuchu', 0.04), ('ervilha', 0.006), ('milho', 0.006), ('cebola', 0.012), ('polpa', 0.02), ('oleo', 0.004), ('sal', 0.0012), ('alho', 0.002)], 'Refogue cebola e alho, junte os legumes em cubos e a polpa com um pouco de água e cozinhe até macios.', 'Legumes'),
    ('Creme de milho', [('milho', 0.025), ('leite', 0.06), ('creme_leite', 0.03), ('manteiga', 0.005), ('farinha', 0.004), ('cebola', 0.008), ('sal', 0.0008)], 'Bata metade do milho com o leite. Refogue cebola na manteiga, junte a farinha, o leite batido e o resto do milho e mexa até engrossar. Finalize com creme de leite.', 'Legumes'),
    ('Beterraba cozida', [('beterraba', 0.08), ('azeite', 0.004), ('sal', 0.0008), ('salsa', 0.002)], 'Cozinhe a beterraba com casca até macia, descasque, corte em cubos e tempere com azeite, sal e salsa.', 'Legumes'),
    ('Abobrinha e cenoura grelhadas', [('abobrinha', 0.08), ('cenoura', 0.04), ('azeite', 0.006), ('sal', 0.001), ('oregano', 0.005)], 'Corte em fatias, tempere e grelhe na chapa até marcar.', 'Legumes'),
    ('Quiabo refogado', [('quiabo', 0.08), ('cebola', 0.012), ('tomate', 0.02), ('alho', 0.002), ('oleo', 0.006), ('sal', 0.001)], 'Doure o quiabo em rodelas em fogo alto até parar de babar. Junte cebola, alho e tomate e refogue 3 min.', 'Legumes'),
    ('Brócolis no alho', [('brocolis', 0.08), ('alho', 0.003), ('azeite', 0.005), ('sal', 0.0008)], 'Cozinhe o brócolis 2 min em água fervente e salteie com alho e azeite.', 'Legumes'),
    ('Farofa de ovo', [('farinha_mandioca', 0.03), ('ovo', 0.5), ('manteiga', 0.008), ('cebola', 0.01), ('sal', 0.0008), ('cebolinha', 0.002)], 'Doure a cebola na manteiga, junte os ovos e mexa. Junte a farinha aos poucos até ficar soltinha.', 'Farofas'),
    ('Farofa de bacon', [('farinha_mandioca', 0.03), ('bacon', 0.015), ('cebola', 0.01), ('manteiga', 0.004), ('sal', 0.0005)], 'Doure o bacon, junte cebola e manteiga e depois a farinha aos poucos, mexendo até tostar.', 'Farofas'),
    ('Farofa de cebola', [('farinha_mandioca', 0.03), ('cebola', 0.02), ('manteiga', 0.008), ('sal', 0.0008)], 'Doure bem a cebola na manteiga e junte a farinha aos poucos até tostar.', 'Farofas'),
    ('Farofa de couve', [('farinha_mandioca', 0.025), ('couve', 0.02), ('alho', 0.002), ('manteiga', 0.008), ('sal', 0.0008)], 'Doure o alho na manteiga, junte a couve fina e logo a farinha, mexendo até soltar.', 'Farofas'),
    ('Farofa de banana', [('farinha_mandioca', 0.025), ('banana', 0.4), ('manteiga', 0.008), ('cebola', 0.01), ('sal', 0.0005)], 'Doure a cebola na manteiga, junte a banana em rodelas, depois a farinha aos poucos.', 'Farofas'),
    ('Farofa de calabresa', [('farinha_mandioca', 0.03), ('calabresa', 0.02), ('cebola', 0.01), ('manteiga', 0.004), ('salsa', 0.002)], 'Doure a calabresa picada, junte cebola e manteiga e a farinha aos poucos.', 'Farofas'),
    ('Farofa de farinha de rosca', [('farinha_rosca', 0.025), ('manteiga', 0.01), ('alho', 0.002), ('salsa', 0.002), ('sal', 0.0005)], 'Doure o alho na manteiga e junte a farinha de rosca mexendo até tostar. Finalize com salsa.', 'Farofas'),
    ('Vinagrete', [('tomate', 0.04), ('cebola', 0.015), ('pimentao', 0.01), ('vinagre', 0.006), ('azeite', 0.005), ('sal', 0.0008), ('salsa', 0.002)], 'Pique tudo em cubinhos e tempere com vinagre, azeite, sal e salsa. Deixe descansar 15 min.', 'Molhos'),
    ('Molho de tomate caseiro', [('polpa', 0.05), ('tomate', 0.03), ('cebola', 0.01), ('alho', 0.002), ('azeite', 0.004), ('acucar', 0.001), ('sal', 0.0008), ('manjericao', 0.01)], 'Refogue cebola e alho no azeite, junte tomate e polpa, uma pitada de açúcar e cozinhe 20 min. Finalize com manjericão.', 'Molhos'),
    ('Molho de pimenta da casa', [('pimentao_verm', 0.01), ('calabresa_pimenta', 0.0005), ('vinagre', 0.005), ('azeite', 0.004), ('alho', 0.001), ('sal', 0.0003)], 'Bata pimentão vermelho, alho, pimenta calabresa, vinagre e azeite. Acerte o sal.', 'Molhos'),
    ('Maionese de alho (molho)', [('maionese', 0.015), ('alho', 0.001), ('limao', 0.002), ('salsa', 0.001)], 'Misture a maionese com alho picado bem fino, limão e salsa.', 'Molhos'),
    ('Macarrão alho e óleo (guarnição)', [('macarrao', 0.1), ('alho', 0.004), ('azeite', 0.006), ('sal', 0.001), ('salsa', 0.002)], 'Cozinhe o macarrão al dente. Doure o alho no azeite e misture com salsa.', 'Massas'),
    ('Macarrão na manteiga', [('macarrao', 0.1), ('manteiga', 0.008), ('queijo_ralado', 0.005), ('sal', 0.001)], 'Cozinhe o macarrão al dente e misture manteiga e queijo ralado.', 'Massas'),
    ('Pão de alho de forma', [('pao_forma', 0.08), ('manteiga', 0.01), ('alho', 0.002), ('queijo_ralado', 0.004), ('salsa', 0.001)], 'Misture manteiga, alho, queijo ralado e salsa, passe no pão de forma e asse até dourar.', 'Massas'),
]
for nome, itens, modo, cat in LEGUMES:
    add(nome, 'acompanhamento', cat, itens, modo)

# ---------------------------------------------------------------- saladas
TEMPERO = [('azeite', 0.005), ('vinagre', 0.004), ('sal', 0.0006)]
SALADAS = [
    ('Salada de alface e tomate', [('alface', 0.12), ('tomate', 0.05)]),
    ('Salada de alface, tomate e cebola', [('alface', 0.1), ('tomate', 0.04), ('cebola', 0.01)]),
    ('Salada mista', [('alface', 0.08), ('tomate', 0.035), ('cenoura', 0.02), ('pepino', 0.025), ('cebola', 0.008)]),
    ('Salada de alface americana com cenoura', [('alface_am', 0.1), ('cenoura', 0.03)]),
    ('Salada de alface americana e pepino', [('alface_am', 0.1), ('pepino', 0.04)]),
    ('Salada de folhas com tomate cereja', [('alface', 0.06), ('rucula', 0.06), ('tomate_cereja', 0.03)]),
    ('Salada de rúcula com tomate', [('rucula', 0.12), ('tomate', 0.04)]),
    ('Salada de rúcula com queijo coalho e tomate', [('rucula', 0.1), ('tomate', 0.03), ('coalho', 0.015)]),
    ('Salada de agrião', [('agriao', 0.12), ('cebola_roxa', 0.008)]),
    ('Salada de agrião com laranja', [('agriao', 0.1), ('laranja', 0.05), ('cebola_roxa', 0.006)]),
    ('Salada de repolho com cenoura', [('repolho', 0.05), ('cenoura', 0.03)]),
    ('Salada de repolho roxo', [('repolho_roxo', 0.05), ('cebola', 0.006)]),
    ('Salada de repolho verde e roxo', [('repolho', 0.03), ('repolho_roxo', 0.03), ('cenoura', 0.015)]),
    ('Salada de repolho com tomate', [('repolho', 0.05), ('tomate', 0.03)]),
    ('Salada de repolho com maçã', [('repolho', 0.05), ('maca', 0.03), ('limao', 0.003)]),
    ('Salada de pepino', [('pepino', 0.07), ('cebola', 0.006), ('salsa', 0.001)]),
    ('Salada de tomate com cebola', [('tomate', 0.07), ('cebola', 0.015), ('salsa', 0.001), ('oregano', 0.004)]),
    ('Salada de tomate com pepino', [('tomate', 0.04), ('pepino', 0.04), ('cebola_roxa', 0.006)]),
    ('Cenoura ralada', [('cenoura', 0.06), ('limao', 0.003)]),
    ('Beterraba ralada', [('beterraba', 0.06), ('limao', 0.003)]),
    ('Cenoura e beterraba raladas', [('cenoura', 0.035), ('beterraba', 0.035)]),
    ('Salada de beterraba cozida com cebola', [('beterraba', 0.07), ('cebola', 0.008), ('salsa', 0.001)]),
    ('Salada de chuchu', [('chuchu', 0.08), ('cebola', 0.006), ('salsa', 0.001)]),
    ('Salada de legumes cozidos', [('cenoura', 0.03), ('chuchu', 0.03), ('batata', 0.03), ('beterraba', 0.02), ('salsa', 0.001)]),
    ('Salada de couve-flor', [('couve_flor', 0.07), ('cenoura', 0.015), ('salsa', 0.001)]),
    ('Salada de abobrinha grelhada', [('abobrinha', 0.07), ('tomate_cereja', 0.02), ('oregano', 0.004)]),
    ('Salada de berinjela', [('berinjela', 0.07), ('pimentao', 0.01), ('cebola', 0.008), ('oregano', 0.004)]),
    ('Salada de alface com laranja', [('alface', 0.1), ('laranja', 0.04)]),
    ('Salada de alface com cebola roxa e pepino', [('alface', 0.1), ('cebola_roxa', 0.008), ('pepino', 0.03)]),
    ('Salada de pimentões', [('pimentao', 0.03), ('pimentao_verm', 0.03), ('cebola_roxa', 0.008)]),
    ('Salada caprese', [('tomate', 0.06), ('mussarela', 0.025), ('manjericao', 0.01), ('oregano', 0.003)]),
    ('Salada de milho e ervilha', [('milho', 0.012), ('ervilha', 0.012), ('tomate', 0.02), ('cebola', 0.006)]),
    ('Salada de cogumelo', [('cogumelo', 0.04), ('alface', 0.06), ('limao', 0.003)]),
    ('Salada de repolho com laranja', [('repolho', 0.05), ('laranja', 0.03)]),
]
for nome, itens in SALADAS:
    add(nome, 'salada', 'Saladas', itens + TEMPERO, 'Lave e higienize as folhas e legumes (solução clorada 15 min e enxágue). Corte, monte na travessa e tempere na hora de servir com azeite, vinagre e sal.')

SALADAS_MAIONESE = [
    ('Salada de maionese', [('batata', 0.08), ('cenoura', 0.03), ('ervilha', 0.006), ('milho', 0.006), ('maionese', 0.025), ('ovo', 0.25), ('salsa', 0.001), ('sal', 0.0008)], 'Cozinhe batata e cenoura em cubos al dente e esfrie. Misture com ervilha, milho, ovo cozido picado e maionese. Acerte o sal.'),
    ('Salada de batata', [('batata', 0.1), ('maionese', 0.02), ('cebolinha', 0.002), ('cebola', 0.006), ('sal', 0.0008)], 'Cozinhe a batata em cubos al dente, esfrie e misture com maionese, cebola e cebolinha.'),
    ('Salada de batata com bacon', [('batata', 0.1), ('bacon', 0.01), ('maionese', 0.015), ('mostarda', 0.003), ('cebolinha', 0.002), ('sal', 0.0006)], 'Cozinhe a batata, doure o bacon e misture tudo com maionese, mostarda e cebolinha.'),
    ('Coleslaw (salada de repolho cremosa)', [('repolho', 0.05), ('repolho_roxo', 0.015), ('cenoura', 0.02), ('maionese', 0.02), ('vinagre', 0.002), ('acucar', 0.001), ('sal', 0.0005)], 'Corte o repolho bem fino e rale a cenoura. Misture maionese, vinagre, açúcar e sal e envolva tudo. Gelar 30 min.'),
    ('Salada de macarrão', [('macarrao', 0.06), ('cenoura', 0.02), ('milho', 0.006), ('presunto', 0.015), ('maionese', 0.02), ('salsa', 0.001), ('sal', 0.0006)], 'Cozinhe o macarrão (parafuso, se tiver) e esfrie. Misture com cenoura ralada, milho, presunto em cubos e maionese.'),
    ('Salada de macarrão com atum', [('macarrao', 0.06), ('atum', 0.025), ('tomate', 0.02), ('milho', 0.006), ('maionese', 0.015), ('sal', 0.0006)], 'Cozinhe e esfrie o macarrão. Misture atum, tomate, milho e maionese.'),
    ('Salada de pepino com iogurte', [('pepino', 0.07), ('iogurte', 0.03), ('alho', 0.001), ('sal', 0.0006), ('salsa', 0.001)], 'Corte o pepino em rodelas finas e misture iogurte, alho, sal e salsa.'),
    ('Salada de frango com maionese', [('peito', 0.05), ('cenoura', 0.02), ('milho', 0.006), ('maionese', 0.02), ('alface', 0.04), ('sal', 0.0006)], 'Cozinhe e desfie o frango, misture com cenoura ralada, milho e maionese e sirva sobre folhas de alface.'),
    ('Salada de ovos', [('ovo', 1), ('batata', 0.05), ('maionese', 0.012), ('cebolinha', 0.002), ('sal', 0.0006)], 'Cozinhe ovos e batata, pique e misture com maionese e cebolinha.'),
    ('Salada de grão-de-bico', [('grao_bico', 0.03), ('tomate', 0.03), ('cebola_roxa', 0.008), ('pepino', 0.02), ('salsa', 0.002), ('azeite', 0.005), ('limao', 0.004), ('sal', 0.0006)], 'Cozinhe o grão-de-bico e esfrie. Misture com tomate, pepino, cebola roxa e salsa e tempere com azeite, limão e sal.'),
    ('Salada de lentilha', [('lentilha', 0.03), ('tomate', 0.03), ('cebola_roxa', 0.008), ('salsa', 0.002), ('azeite', 0.005), ('vinagre', 0.003), ('sal', 0.0006)], 'Cozinhe a lentilha al dente e esfrie. Misture com tomate, cebola roxa e salsa e tempere.'),
    ('Salada de feijão', [('feijao', 0.03), ('tomate', 0.03), ('cebola', 0.01), ('pimentao', 0.01), ('salsa', 0.002), ('azeite', 0.005), ('vinagre', 0.004), ('sal', 0.0006)], 'Cozinhe o feijão al dente (sem tempero) e esfrie. Misture com os legumes picados e tempere como vinagrete.'),
    ('Salada de brócolis', [('brocolis', 0.06), ('cenoura', 0.015), ('azeite', 0.005), ('limao', 0.003), ('sal', 0.0006)], 'Cozinhe o brócolis 2 min, esfrie e tempere com cenoura ralada, azeite, limão e sal.'),
    ('Salada de frutas', [('banana', 0.3), ('maca', 0.04), ('laranja', 0.05), ('acucar', 0.003)], 'Corte as frutas em cubos, misture com o suco da laranja e um pouco de açúcar. Gelar.'),
]
for nome, itens, modo in SALADAS_MAIONESE:
    add(nome, 'salada', 'Saladas', itens, modo)

json.dump({'tamanhos': TAMANHOS, 'fichas': fichas}, sys.stdout, ensure_ascii=False, separators=(',', ':'))
print(f'{len(fichas)} fichas: ' + ', '.join(f"{t} {sum(1 for f in fichas if f['tipo'] == t)}" for t in ('prato', 'acompanhamento', 'salada'))
      + f"; com material faltando: {sum(1 for f in fichas if any(i['codigo'] is None for i in f['itens']))}", file=sys.stderr)
