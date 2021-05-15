(function (document) {
    'use strict';

    // ======================
    // SIDEBAR
    // ======================

    let sidebarIframe;

    function injectSidebar() {

        // Thanks to https://stackoverflow.com/a/11530115

        // Within a content script:
        sidebarIframe = document.createElement('iframe');
        sidebarIframe.id = 'notarealscreenreader-iframe';
        sidebarIframe.src = chrome.runtime.getURL('iframe.html');
        // console.log('SOURCE:',f.src);

        // styles and margin trick is copied from WAVE toolbar
        // TODO: move to css?
        let styles = {
            'width': '270px',
            'height': '100%',
            'float': 'left',
            'position': 'fixed',
            'border-right': '2px solid #66AC99',
            'z-index': 2147483646,
            'top': '0',
            'left': '0',
            'background-color': '#66cc99'
        };
        Object.assign(sidebarIframe.style, styles);

        document.querySelector("body").after(sidebarIframe);

        // apply margin to html
        document.documentElement.style.marginLeft = '270px';

        // find all position:fixed divs and apply also margin 
        // fork of https://stackoverflow.com/a/35055063
        var elems = document.body.getElementsByTagName("*");
        var len = elems.length;
        for (var i = 0; i < len; i++) {
            if (window.getComputedStyle(elems[i], null).getPropertyValue('position') == 'fixed') {
                // this will not cover all cases, but we move all left bound items to the correct position
                let computed = getComputedStyle(elems[i]);
                let computedLeft = computed.getPropertyValue("left");
                console.log(elems[i],computedLeft);
                if(computedLeft == '0px' || computedLeft == '0'){
                    elems[i].style.left = '270px';
                }
            }
        }

        //document.body.prepend(f);
    }

    injectSidebar();

    // ======================
    // SCREENREADER
    // ======================

    // Fork of sr-poc
    // https://github.com/Comandeer/sr-poc/blob/master/js/sr.js
    // (license unknown)

    let isRunning = false;
    let focusList = [];
    let focusIndex = 0;

    const mappings = {
        a: 'link',
        button: 'button',
        h2: 'heading',
        p: 'paragraph',
        html: 'page',
        img: 'image'
    };

    function computeAccessibleName(element) {
        const content = element.textContent.trim();

        if (element.getAttribute('aria-label')) {
            return element.getAttribute('aria-label');
        } else if (element.getAttribute('alt')) {
            return element.getAttribute('alt');
        }

        return content;
    }

    const announcers = {
        page(element) {
            const title = element.querySelector('title').textContent;

            say(`Page ${ title }`);
        },

        link(element) {
            say(`Link, ${ computeAccessibleName( element ) }. To follow the link, press Enter key.`);
        },

        button(element) {
            say(`Button, ${ computeAccessibleName( element ) }. To press the button, press Space key.`);
        },

        heading(element) {
            const level = element.getAttribute('aria-level') || element.tagName[1];

            say(`Heading level ${ level }, ${ computeAccessibleName( element ) }`);
        },

        paragraph(element) {
            say(element.textContent);
        },

        image(element) {
            say(`Image, ${ computeAccessibleName( element ) }`);
        },

        default (element) {
            say(`${ element.tagName } element: ${ computeAccessibleName( element ) }`);
        }
    };

    function addStyles() {
        const styleElement = document.createElement('style');

        styleElement.textContent = `[tabindex="-1"] {
			outline: none;;
		}
		[data-sr-current] {
			outline: 5px rgba( 0, 0, 0, .7 ) solid !important;
		}
		html[data-sr-current] {
			outline-offset: -5px;
		}`;

        document.head.appendChild(styleElement);
    }

    function say(speech, callback) {
        const text = new SpeechSynthesisUtterance(speech);

        if (callback) {
            text.onend = callback;
        }

        speechSynthesis.cancel();
        speechSynthesis.speak(text);
    }

    function computeRole(element) {
        const name = element.tagName.toLowerCase();

        if (element.getAttribute('role')) {
            return element.getAttribute('role');
        }

        return mappings[name] || 'default';
    }

    function announceElement(element) {
        const role = computeRole(element);

        if (announcers[role]) {
            announcers[role](element);
        } else {
            announcers.default(element);
        }
    }

    function createFocusList() {
        focusList.push(...document.querySelectorAll('html, body >:not( [aria-hidden=true] )'));

        focusList = focusList.filter((element) => {
            const styles = getComputedStyle(element);

            if (styles.visibility === 'hidden' || styles.display === 'none') {
                return false;
            }

            return true;
        });

        focusList.forEach((element) => {
            element.setAttribute('tabindex', element.tabIndex);
        });

        console.log('Finished focus list',focusList);
    }

    function getActiveElement() {
        if (document.activeElement && document.activeElement !== document.body) {
            return document.activeElement;
        }

        return focusList[0];
    }

    function focus(element) {
        if (element === document.body) {
            element = document.documentElement;
        }

        element.setAttribute('data-sr-current', true);
        element.focus();

        announceElement(element);
    }

    function moveFocus(offset) {
        const last = document.querySelector('[data-sr-current]');

        if (last) {
            last.removeAttribute('data-sr-current');
        }

        if (offset instanceof HTMLElement) {
            focusIndex = focusList.findIndex((element) => {
                return element === offset;
            });

            return focus(offset);
        }

        focusIndex = focusIndex + offset;

        if (focusIndex < 0) {
            focusIndex = focusList.length - 1;
        } else if (focusIndex > focusList.length - 1) {
            focusIndex = 0;
        }

        focus(focusList[focusIndex]);
    }

    function start() {
        say('Screen reader on', () => {
            // because we have an iframe, we need to focus window again, otherwise it's iframe element
            window.focus();

            // original first function:
            moveFocus(getActiveElement());

            isRunning = true;
        });
    }

    function stop() {
        const current = document.querySelector('[data-sr-current]');

        if (current) {
            current.removeAttribute('data-sr-current');
        }

        focusIndex = 0;
        isRunning = false;

        say('Screen reader off');
    }

    function userActionSwitchOn() {
        start();
    }

    function userActionSwitchOff() {
        stop();
    }

    function userActionTab() {
        moveFocus(1);
    }

    function userActionTabBackwards() {
        moveFocus(-1);
    }

    function userActionHidePage() {
        document.body.style.display = 'none';
    }

    // we deactivate it by now to not complicate things
    /* function keyDownHandler(evt) {
        // deactivate tab key completely
        if (evt.keyCode == 9) {
            console.log('Prevented tab action...',evt);
            evt.preventDefault();
            evt.stopPropagation();
        }
    }*/
    /*
    // see original: https://github.com/Comandeer/sr-poc/blob/master/js/sr.js
    function keyDownHandler( evt ) {
		if ( evt.altKey && evt.keyCode === 82 ) {
			evt.preventDefault();

			if ( !isRunning ) {
				start();
			} else {
				stop();
			}
		}

		if ( !isRunning ) {
			return false;
		}

		if ( evt.altKey && evt.keyCode === 9 ) {
			evt.preventDefault();

			moveFocus( evt.shiftKey ? -1 : 1 );
		} else if ( evt.keyCode === 9 ) {
			setTimeout( () => {
				moveFocus( document.activeElement );
			}, 0 );
		}
	}
    */

    function clickHandler(btnClickedId) {
        switch (btnClickedId) {
            case 'btnSwitchOn':
                userActionSwitchOn();
                break;
            case 'btnSwitchOff':
                userActionSwitchOff();
                break;
            case 'btnTab':
                userActionTab();
                break;
            case 'btnTabBackwards':
                userActionTabBackwards();
                break;
            case 'btnHidePage':
                userActionHidePage();
                break;
        }
    }

    addStyles();
    createFocusList();

    // this is for the original DOM/html
    //document.addEventListener('keydown', keyDownHandler);

    // this is for receiving messages from the injected iframe, see iframe.js
    // see https://developer.chrome.com/docs/extensions/mv3/messaging/
    addEventListener("message", function (event) {
        //console.log('received message', event, event.data);
        // check if it came from extension
        if (event.origin + "/" == chrome.runtime.getURL("")) {
            clickHandler(event.data.btnClickedId);
        }
    });

}(document));