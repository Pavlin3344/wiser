"""Тестове на геометричната част от risk zones job-а.

Тези три неща вече са били счупени наживо и се виждат само на картата, не в логовете:
стъпката на решетката (празнини между клетките), рязането по границата на България
(зони над Сърбия и Черно море) и ъглите на клетката.
"""
import pytest

from job import _half_step, cell_wkt, grid_half_steps, in_bulgaria, load_border

BORDER = load_border()


def test_half_step_on_even_grid():
    assert _half_step([1.0, 1.2, 1.4, 1.6]) == pytest.approx(0.1)


def test_half_step_ignores_gaps():
    """Взима минимума, не средното.

    EFFIS пропуска точки без стойност. Получената двойна дупка (1.2 липсва) иначе се
    брои за стъпка на решетката и клетките излизат по-широки, отколкото са.
    """
    assert _half_step([1.0, 1.4, 1.6, 1.8]) == pytest.approx(0.1)


def test_half_step_falls_back_when_single_value():
    """Една стойност → няма от какво да се изведе стъпка, ползва се резервната."""
    assert _half_step([42.0]) == pytest.approx(0.036)


def test_grid_half_steps_are_per_axis():
    """Дължина и ширина се смятат поотделно.

    Обща константа за двете оси оставяше ~2 км празнина между всяка двойка колони,
    защото градус дължина покрива по-малко земя от градус ширина на тази ширина.
    """
    points = [
        (42.0, 25.0, 10.0, 3),
        (42.0, 25.2, 10.0, 3),
        (42.3, 25.0, 10.0, 3),
        (42.3, 25.2, 10.0, 3),
    ]
    h_lon, h_lat = grid_half_steps(points)
    assert h_lon == pytest.approx(0.1)
    assert h_lat == pytest.approx(0.15)


def _ring(wkt):
    """WKT полигон → списък от (lon, lat) двойки."""
    return [tuple(float(v) for v in pair.split()) for pair in wkt[len("POLYGON(("):-2].split(", ")]


def test_cells_tile_without_gaps():
    """Десният ръб на едната клетка съвпада с левия ръб на съседната.

    Сравнява се като числа, а не като текст: 25.2 - 0.1 дава 25.099999999999998, така
    че двата ръба се изписват различно в WKT-то, макар да са същата точка.
    """
    h_lon, h_lat = 0.1, 0.15
    left_edges = [x for x, _ in _ring(cell_wkt(25.0, 42.0, h_lon, h_lat))]
    right_edges = [x for x, _ in _ring(cell_wkt(25.2, 42.0, h_lon, h_lat))]
    assert max(left_edges) == pytest.approx(min(right_edges))


def test_cell_wkt_is_a_closed_ring():
    coords = _ring(cell_wkt(25.0, 42.0, 0.1, 0.15))
    assert len(coords) == 5
    assert coords[0] == coords[-1]
    lons = {round(x, 6) for x, _ in coords}
    lats = {round(y, 6) for _, y in coords}
    assert lons == {24.9, 25.1}   # център ± половин стъпка
    assert lats == {41.85, 42.15}


@pytest.mark.parametrize(
    "name, lon, lat",
    [
        ("София", 23.32, 42.70),
        ("Пловдив", 24.75, 42.14),
        ("Шумен", 26.93, 43.27),
        ("Смолян (близо до южната граница)", 24.69, 41.58),
    ],
)
def test_points_inside_bulgaria(name, lon, lat):
    """Само вътрешни градове.

    Очертанието в `bulgaria_border.json` е опростено (879 точки за цялата страна), та
    брегът минава 1-2 км навътре от реалния. Варна и Созопол излизат "извън" — при
    клетки от ~8 км това не мести нищо съществено, но не става за тест на границата.
    """
    assert in_bulgaria(lon, lat, BORDER), name


@pytest.mark.parametrize(
    "name, lon, lat",
    [
        ("Букурещ", 26.10, 44.43),
        ("Солун", 22.94, 40.64),
        ("Ниш", 21.90, 43.32),
        ("Истанбул", 28.98, 41.01),
        # Тази е важната: в правоъгълника на решетката, но в морето. Само bbox
        # проверка би я пуснала и зоните тръгваха навътре в Черно море.
        ("Черно море", 28.40, 43.00),
    ],
)
def test_points_outside_bulgaria(name, lon, lat):
    assert not in_bulgaria(lon, lat, BORDER), name
