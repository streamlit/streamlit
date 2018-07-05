import React, { PureComponent } from 'react';
import { Balloons as BalloonsProto } from '../protobuf';
import './Balloons.css';

const NUM_BALLOONS = 15;
const POS_MIN_VW = 30;
const POS_MAX_VW = 70;
const DELAY_MAX_MS = 500;

const BALLOON_PROB = 0.5;

const MAX_ANIMATION_DURATION_MS = 1000;  // see CSS

class Balloons extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      drawnId: true,
    };
  }

  render() {
    if (this.state.drawnId === this.props.balloons.get('executionId')) {
      return '';
    }

    this.setTimer();

    return (
      <div className="balloons">
        {Array.from({length: NUM_BALLOONS}, (i) => (
          <img
            className="balloon"
            src={getBalloonUrl(this.props.balloons)}
            style={{
              left: Math.random() * (POS_MAX_VW - POS_MIN_VW)
                  + POS_MIN_VW + 'vw',
              animationDelay: Math.random() * DELAY_MAX_MS + 'ms',
            }}
          />
        ))}
      </div>
    );
  }

  setTimer() {
    // Remove DOM elements after animation ends.
    window.setTimeout(
        () => this.setState({
          drawnId: this.props.balloons.get('executionId'),
        }),
        MAX_ANIMATION_DURATION_MS + DELAY_MAX_MS + 100);
  }
}


function getBalloonUrl(balloonsProto) {
  const type = balloonsProto.get('type');

  if (type === BalloonsProto.Type.DEFAULT) {
    if (Math.random() > BALLOON_PROB) {
      const rand = Math.ceil(Math.random() * (BALLOON_IMAGES.length - 1));
      return BALLOON_IMAGES[rand];
    } else {
      return BALLOON_IMAGES[BalloonsProto.Type.BALLOON];
    }
  }

  return BALLOON_IMAGES[type];
}

const BALLOON_IMAGES = [];
BALLOON_IMAGES[0] = '';;  // 0 means random
BALLOON_IMAGES[BalloonsProto.Type.BALLOON] = 'emoji/emoji_u1f388.png';
BALLOON_IMAGES[BalloonsProto.Type.HAPPY_FACE] = 'emoji/emoji_u1f604.png';
BALLOON_IMAGES[BalloonsProto.Type.STAR_FACE] = 'emoji/emoji_u1f929.png';
BALLOON_IMAGES[BalloonsProto.Type.COOL_FACE] = 'emoji/emoji_u1f60e.png';

export default Balloons;
