/**
 * Copyright 2015 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Observable} from '../../src/observable';
import {adopt} from '../../src/runtime';
import {dev} from '../../src/log';
import {parseUrl} from '../../src/url';
import {getServicePromise} from '../../src/service';
import * as dom from '../../src/dom';
import * as sinon from 'sinon';

describe('runtime', () => {

  let win;
  let sandbox;
  let errorStub;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    win = {
      AMP: [],
      location: {},
      addEventListener: () => {},
      document: window.document,
      history: {},
      navigator: {},
      setTimeout: () => {},
      location: parseUrl('https://acme.com/document1'),
      Object,
      HTMLElement,
    };
    errorStub = sandbox.stub(dev, 'error');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should export properties to global AMP object', () => {
    expect(win.AMP.push).to.equal([].push);
    adopt(win);
    expect(win.AMP.BaseElement).to.be.a('function');
    expect(win.AMP.BaseTemplate).to.be.a('function');
    expect(win.AMP.registerElement).to.be.a('function');
    expect(win.AMP.registerTemplate).to.be.a('function');
    expect(win.AMP.setTickFunction).to.be.a('function');
    expect(win.AMP.win).to.equal(win);
    expect(win.AMP.viewer).to.be.a('object');
    expect(win.AMP.viewport).to.be.a('object');
    expect(win.AMP_TAG).to.be.true;

    expect(win.AMP.push).to.not.equal([].push);
  });

  it('should execute scheduled extensions & execute new extensions', () => {
    let progress = '';
    const queueExtensions = win.AMP;
    win.AMP.push(amp => {
      expect(amp).to.equal(win.AMP);
      progress += '1';
    });
    win.AMP.push(amp => {
      expect(amp).to.equal(win.AMP);
      progress += '2';
    });
    win.AMP.push(amp => {
      expect(amp).to.equal(win.AMP);
      progress += '3';
    });
    expect(queueExtensions).to.have.length(3);
    adopt(win);
    expect(queueExtensions).to.have.length(0);
    expect(progress).to.equal('123');
    win.AMP.push(amp => {
      expect(amp).to.equal(win.AMP);
      progress += '4';
    });
    expect(progress).to.equal('1234');
    win.AMP.push(amp => {
      expect(amp).to.equal(win.AMP);
      progress += '5';
    });
    expect(progress).to.equal('12345');
    expect(queueExtensions).to.have.length(0);
  });

  it('should wait for body before processing extensions', () => {
    const bodyCallbacks = new Observable();
    sandbox.stub(dom, 'waitForBody', (unusedDoc, callback) => {
      bodyCallbacks.add(callback);
    });

    let progress = '';
    const queueExtensions = win.AMP;
    win.AMP.push(amp => {
      expect(amp).to.equal(win.AMP);
      progress += '1';
    });
    win.AMP.push(amp => {
      expect(amp).to.equal(win.AMP);
      progress += '2';
    });
    win.AMP.push(amp => {
      expect(amp).to.equal(win.AMP);
      progress += '3';
    });
    expect(queueExtensions).to.have.length(3);
    adopt(win);

    // Extensions are still unprocessed
    expect(queueExtensions).to.have.length(3);
    expect(progress).to.equal('');

    // Add one more
    win.AMP.push(amp => {
      expect(amp).to.equal(win.AMP);
      progress += '4';
    });
    expect(queueExtensions).to.have.length(3);
    expect(progress).to.equal('');

    // Body is available now.
    bodyCallbacks.fire();
    expect(progress).to.equal('1234');
    expect(queueExtensions).to.have.length(0);
  });

  it('should be robust against errors in early extensions', () => {
    let progress = '';
    win.AMP.push(() => {
      progress += '1';
    });
    win.AMP.push(() => {
      throw new Error('extension error');
    });
    win.AMP.push(() => {
      progress += '3';
    });
    adopt(win);
    expect(progress).to.equal('13');

    expect(errorStub.callCount).to.equal(1);
    expect(errorStub.calledWith('runtime',
        sinon.match(() => true),
        sinon.match(arg => {
          return !!arg.message.match(/extension error/);
        }))).to.be.true;
  });

  describe('registerElement', () => {
    beforeEach(() => {
      adopt(win);
    });

    it('resolves any pending service promises for the element', () => {
      const promise = getServicePromise(win, 'amp-test-register');
      win.AMP.registerElement('amp-test-register', win.AMP.BaseElement);
      return promise;
    });
  });
});
