// https://stackoverflow.com/a/8526096

document.addEventListener('click', function(event){

    // check if button was clicked
    if (!event.target.matches('[type=button]')) return;

    // send message to top window for content-script.js
    //console.log('Clicked ',event.target.id,' - sending to top');
    top.postMessage({'btnClickedId':event.target.id},"*");
},false);
