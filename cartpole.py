import gym
import numpy as np
import pandas as pd
import sys
import time
from PIL import Image

sys.path.append('local/server')
from streamlet import Notebook, Chart


def create_chart(columns):
    frame = pd.DataFrame(columns=columns)
    chart = Chart(frame, 'line_chart')
    chart.x_axis()
    chart.y_axis()
    chart.cartesian_grid(stroke_dasharray='1 1')
    chart.tooltip()
    chart.legend()
    return chart


def run_episode(policy, samples=1, render=False, max_iters=200, handicap=0.0):
    sum_reward = 0
    for s in range(samples):
        observation = env.reset()
        if render:
            chart = notebook.chart(create_chart(state_dims))
        for i in range(max_iters):
            dot = np.matmul(policy, np.append(observation, 1))
            action = max(0, min(env.action_space.n - 1, int(round(dot))))
            if np.random.rand(1)[0] < handicap:
                action = env.action_space.sample()
            observation, reward, done, info = env.step(action)
            sum_reward += reward
            if render:
                env.render()
                chart.add_rows(pd.DataFrame([observation], columns=state_dims))
            if done:
                # hack to reward nice episode ending
                sum_reward -= (observation**2).mean()
                break
    avg_reward = sum_reward / samples
    return avg_reward


def train_model(train_iterations=300,
          episode_iterations=500,
          start_radius=1.0,
          render=False,
          episode_samples=20):
    policy_length = env.observation_space.shape[0] + 1
    best_policy = np.zeros(policy_length)
    best_reward = 0
    radius = start_radius
    last_rewards = []

    for i in range(train_iterations):
        policy = best_policy + np.random.randn(policy_length) * radius
        reward = run_episode(
            policy, samples=episode_samples, max_iters=episode_iterations)

        if reward > best_reward:
            best_reward = reward
            best_policy = policy
            radius *= 1.1
        else:
            radius /= 1.01

        if render and i % (train_iterations / 5) == 0:
            frame = pd.DataFrame(
                [policy], columns=state_dims + ['1'], index=[[i]])
            notebook(frame)
            run_episode(best_policy, render=True)

        last_rewards += [reward]
        if i % 10 == 0:
            reward_chart.add_rows(
                [[best_reward,
                  np.amin(last_rewards),
                  np.amax(last_rewards)]])
            policy_chart.add_rows([best_policy])
            radius_chart.add_rows([[radius]])
            progress.progress(int(100 * i / train_iterations))
            last_rewards = []

    progress.progress(100)
    return best_policy, best_reward


with Notebook() as notebook:
    state_dims = ['x', 'x_dot', 'theta', 'theta_dot']
    env = gym.make('CartPole-v1')
    render = True

    notebook.header('CartPole', level=1)
    notebook("""
This example demonstrates how to visualize a basic reinforcement learning process. We attempt to find an optimal policy for the CartPole system in which we balance a pole on a cart by moving the cart sideways.
""")
    notebook.img(np.array(Image.open('examples/cartpole.png'))[:, :, 0:3], width=400)
    notebook("""
We use a simple hill climbing approach that tries random variations based on the best policy at that point.
""")
    notebook("""
More info on the cartpole system: https://gym.openai.com/envs/CartPole-v1
""")
    progress = notebook.progress(0)

    notebook.header('Rewards')
    notebook("""
After every run of our policy in the simulator, we receive a reward. This graphs shows the best rewards so far, as well as the range of rewards being explored.
""")
    reward_chart = notebook.chart(
        create_chart(['best so far', 'batch min', 'batch max']))

    notebook.header('Policy')
    notebook("""
The policy specifies which action to take based on the last observation. It consists of %d weight factors that are used to sum and round to action 0 (go left) and 1 (go right). This graph shows the best weight factors so far.
""" % (len(state_dims) + 1))
    policy_chart = notebook.chart(create_chart(state_dims + ['1']))

    notebook.header('Annealing')
    notebook("""
The search for better policies is bases on a search radius that specifies how much variation to apply to the best policy so far. As we get better results, the radius is reduced for more fine-grained search.
""")
    radius_chart = notebook.chart(create_chart(['sample radius']))

    if render:
        notebook.header('Episodes')
        notebook("""
This shows a series of sample runs with the best policy. These are graphs of the observed state.
""")

    best_policy, best_reward = train_model(render=render)
    print('best policy: %s' % best_policy)
    print('best reward: %s' % best_reward)
