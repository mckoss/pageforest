from django import forms

from utils.shortcuts import render_to_response


class DemoForm(forms.Form):
    key = forms.CharField(widget=forms.TextInput(attrs={'class': 'focus'}))
    value = forms.CharField()


def index(request):
    return render_to_response(request, 'demo/index.html', locals())


def rest(request):
    demo_form = DemoForm(request.GET or None)
    return render_to_response(request, 'demo/rest.html', locals())


def jsonp(request):
    demo_form = DemoForm(request.GET or None)
    return render_to_response(request, 'demo/jsonp.html', locals())
