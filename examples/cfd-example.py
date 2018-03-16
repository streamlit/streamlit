import numpy as np
import pandas as pd
import math
import sys

from streamlit import Notebook, Chart

def print_vel_stats(vel):
    stats = (
        ('x min', np.min(vel[0])),
        ('x max', np.max(vel[0])),
        ('y min', np.min(vel[1])),
        ('y max', np.max(vel[1])))
    keys, values = zip(*stats)
    print(pd.DataFrame(np.array(values), index=keys, columns=['value']))

def display_field(field, clip_at, name=None, loc=None, width=160):
    if (len(field.shape) == 3):
        field = np.flip(field.transpose((0, 2, 1)), axis=1)
    else:
        field = np.flip(field.transpose((1, 0)), axis=0)
    mid_color = np.array([0.7, 0.7, 0.7])
    min_color = np.array([1.0, 0.0, 0.0])
    max_color = np.array([0.0, 0.0, 1.0])
    clipped = np.clip(field / clip_at, -1.0, 1.0).reshape(field.shape + (1,))
    colored = \
        (clipped > 0) * clipped * max_color - \
        (clipped < 0) * clipped * min_color + \
        (1.0 - np.absolute(clipped)) * mid_color
    if len(field) == 2:
        if name == None:
            name = 'vec'
        caption = [f'{name} x', f'{name} y']
    else:
        if name == None:
            caption = 'scalar'
        else:
            caption = name
    if loc == None:
        loc = print
    loc.img(colored, width=width, caption=caption)

def enforce_boundaries(dens, vels):
    vel = np.array(vels)
    vels[0,0,:] = vels[1,:,0] = 0.0
    print('enforcing boundaries:', type(dens))
    dens[:,0] = 0.0
    return dens, vels

def div(vels):
    """Computes the divergence for a vector field."""
    div = vels[0] + vels[1]
    div[:-1,:] -= vels[0,1:,:]
    div[:,:-1] -= vels[1,:,1:]
    return div

def grad(rho):
    """Computes the gradient of a scalar field."""
    grad = np.zeros((2,) + rho.shape)
    grad[0,1:, :] = rho[1:,:] - rho[:-1,:]
    grad[1, :,1:] = rho[:,1:] - rho[:,:-1]
    return grad

def max_div(vels):
    return np.max(np.abs(div(vels)))

def enforce_divergence_free(vels):
    vels = np.array(vels)
    divergence = div(vels)
    pressure = np.zeros(divergence.shape)

    factor = np.zeros(divergence.shape) + 4.0
    factor[0,:] = factor[-1,:] = factor[:,0] = factor[:,-1] = 3.0
    factor[0,0] = factor[0,-1] = factor[-1,0] = factor[-1,-1] = 2.0

    # chart_data = pd.DataFrame(columns=['div'])
    # div_chart = Chart(chart_data, 'line_chart', height=200)
    # div_chart.y_axis()
    # div_chart.cartesian_grid(stroke_dasharray='3 3')
    # div_chart.legend()
    # div_chart.line(type='linear', data_key='div', stroke='#8884d8', dot="false")
    # div_chart = print.chart(div_chart)
    for i in range(100):
        new_pressure = np.array(divergence)
        new_pressure[ :-1, :  ] += pressure[ 1:  , :  ]
        new_pressure[1:  , :  ] += pressure[  :-1, :  ]
        new_pressure[ :  , :-1] += pressure[  :  ,1:  ]
        new_pressure[ :  ,1:  ] += pressure[  :  , :-1]
        new_pressure /= factor
        pressure = new_pressure
        maximum_div = max_div(vels - grad(pressure))
        # new_row = pd.DataFrame([maximum_div], columns=['div'])
        # div_chart.add_rows(new_row)

    # display_field(divergence, 3.0, 'divergence before')
    # display_field(div(vels - grad(pressure)), 3.0, 'divergence after')
    return vels - grad(pressure)

def interpolate(x, y, field, offset):
    x -= offset[0]
    y -= offset[1]
    x_floor = int(math.floor(x))
    y_floor = int(math.floor(y))
    delta_x = x - x_floor
    delta_y = y - y_floor
    coefs = np.array([
        (1.0 - delta_x) * (1.0 - delta_y),
        delta_x         * (1.0 - delta_y),
        delta_x         * delta_y,
        (1.0 - delta_x) * delta_y
    ])
    assert np.min(coefs) >= 0.0
    assert np.max(coefs) <= 1.0
    corners = np.array([
        field[
            np.clip(x_floor    , 0, field.shape[0] - 1),
            np.clip(y_floor    , 0, field.shape[0] - 1)],
        field[
            np.clip(x_floor + 1, 0, field.shape[0] - 1),
            np.clip(y_floor    , 0, field.shape[0] - 1)],
        field[
            np.clip(x_floor + 1, 0, field.shape[0] - 1),
            np.clip(y_floor + 1, 0, field.shape[0] - 1)],
        field[
            np.clip(x_floor    , 0, field.shape[0] - 1),
            np.clip(y_floor + 1, 0, field.shape[0] - 1)]])
    return np.dot(coefs, corners)

def advect(rho, offset, vels, dt):
    """
    Advect the scalar field rho with given offset through the velocity field.
    """
    vel_offsets = [ [0.0, 0.5], [0.5, 0.0] ]

    # now let's do the fast version
    start_coords = np.zeros(rho.shape + (2,))
    start_coords[:,:,0] = np.arange(rho.shape[1]).reshape(-1,1) + offset[0]
    start_coords[:,:,1] = np.arange(rho.shape[0]) + offset[1]
    x_vels = interpolate_fast(start_coords, vels[0], vel_offsets[0])
    y_vels = interpolate_fast(start_coords, vels[1], vel_offsets[1])
    end_coords = start_coords - dt * np.array([x_vels, y_vels]).transpose((1, 2, 0))
    rho_new_prime = interpolate_fast(end_coords, rho, offset)
    return rho_new_prime


def interpolate_fast(coords, field, offset):
    assert coords.shape == field.shape + (len(offset),)
    coords -= offset
    floor_coords = np.floor(coords).astype(np.int32)
    delta = coords - floor_coords
    coefs = np.array([
        (1.0 - delta[:,:,0]) * (1.0 - delta[:,:,1]),
        (      delta[:,:,0]) * (1.0 - delta[:,:,1]),
        (      delta[:,:,0]) * (      delta[:,:,1]),
        (1.0 - delta[:,:,0]) * (      delta[:,:,1]),
    ])
    # for i in range(4):
    #     print(coefs[i])
    assert np.min(coefs) >= 0.0
    assert np.max(coefs) <= 1.0
    clip_x = lambda x: np.clip(x, 0, field.shape[0] - 1)
    clip_y = lambda x: np.clip(x, 0, field.shape[1] - 1)
    corners = np.array([
        field[clip_x(floor_coords[:,:,0]    ), clip_y(floor_coords[:,:,1]    )],
        field[clip_x(floor_coords[:,:,0] + 1), clip_y(floor_coords[:,:,1]    )],
        field[clip_x(floor_coords[:,:,0] + 1), clip_y(floor_coords[:,:,1] + 1)],
        field[clip_x(floor_coords[:,:,0]    ), clip_y(floor_coords[:,:,1] + 1)]
    ])
    return (corners * coefs).sum(axis=0)

with Notebook() as print:
    print.header('CFD Example', level=1)

    print.header('Simulation', level=2)
    sim_image = print.alert('no image to display now')


    print.header('Statistics', level=2)
    width, height = 200,200
    dt = 0.5
    heat_coef = 0.5
    print(f'Grid domain: {width}x{height}')
    print(f'dt : {dt}\nheat_coef : {heat_coef}')

    # create some random velocity fields
    vels = np.random.randn(2, width, height)

    # create a density field, with a block of desnity at the bottom.
    dens = np.zeros((width, height))
    dens[int(0.4 * width) : int(0.6 * width), : int(0.2 * height)] = \
        np.random.uniform(0.0, 1.0,
        size=dens[int(0.4 * width) : int(0.6 * width), : int(0.2 * height)].shape)

    # print('Density field:')
    # display_field(dens, 8.0)
    # display_field(vels, 3.0, 'vel')

    # start doing some physics - call
    print.header('Simulation Log', level=2)

    total_density = np.sum(dens)
    for timestep in range(100):
        print.header(f'Timestep: {timestep}', level=3)
        print('dens stats:', np.min(dens), np.max(dens), np.sum(dens))
        vels[1,:,:] += dens * heat_coef
        vels = enforce_divergence_free(vels)
        dens, vels = enforce_boundaries(dens, vels)
        display_field(vels, 3.0, 'vels')
        dens = advect(dens, [0.5, 0.5], vels, dt)
        dens = dens / np.sum(dens) * total_density
        new_vels = np.zeros(vels.shape)
        new_vels[0,:] = advect(vels[0], [0.0, 0.5], vels, dt)
        new_vels[1,:] = advect(vels[1], [0.5, 0.0], vels, dt)
        vels = new_vels
        display_field(dens, 3.0, 'density', width=400, loc=sim_image)
